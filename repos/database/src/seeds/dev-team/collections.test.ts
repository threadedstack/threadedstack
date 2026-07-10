import { describe, it, expect } from 'vitest'

import { EFieldType } from '@tdsk/domain'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { reconcileDevTeam, DevTeamCollectionDefs } from '@TDB/seeds/dev-team/collections'

const ValidFieldTypes = new Set<string>(Object.values(EFieldType))

/**
 * An in-memory fake of the collection service that preserves the behavior the
 * reconcile depends on: getByName resolves an already-created collection
 * (project+name keyed), so a re-run reports it unchanged. This lets the pure
 * reconcile be proven idempotent without a live DB.
 */
const makeFakeServices = () => {
  const collections = new Map<string, any>()

  const services = {
    collection: {
      getByName: async (projectId: string, name: string) => {
        const found = collections.get(`${projectId}:${name}`)
        return found ? { data: found } : {}
      },
      create: async (item: any) => {
        const key = `${item.projectId}:${item.name}`
        if (collections.has(key)) return { error: new Error(`Collection already exists`) }
        collections.set(key, { ...item })
        return { data: { ...item } }
      },
    },
  }

  return { services, collections }
}

describe(`DevTeamCollectionDefs`, () => {
  it(`defines the dev_tasks collection with a stable, valid id`, () => {
    expect(DevTeamCollectionDefs).toHaveLength(1)
    const [def] = DevTeamCollectionDefs
    expect(def.name).toBe(`dev_tasks`)
    expect(def.id).toMatch(/^[A-Za-z0-9_-]{10}$/)
  })

  it(`declares every schema field with a valid EFieldType`, () => {
    for (const def of DevTeamCollectionDefs) {
      expect(def.schema.length).toBeGreaterThan(0)
      for (const field of def.schema) {
        expect(field.name.length).toBeGreaterThan(0)
        expect(ValidFieldTypes.has(field.type)).toBe(true)
      }
    }
  })

  it(`carries every field the concurrent task/review state machine depends on`, () => {
    const [def] = DevTeamCollectionDefs
    const byName = Object.fromEntries(def.schema.map((f) => [f.name, f]))

    // The CAS-guarded transition field + the identity fields both claim kinds
    // key on — the concurrency invariants live in exactly these fields.
    expect(byName.state).toEqual({
      name: `state`,
      type: EFieldType.string,
      required: true,
    })
    expect(byName.assignee?.type).toBe(EFieldType.string)
    expect(byName.reviewer?.type).toBe(EFieldType.string)
    // Lease liveness (renewed by the holder, reaped when expired)
    expect(byName.leaseExpiresAt?.type).toBe(EFieldType.number)
    // GitHub reconciliation anchors (the reaper checks these before reclaiming;
    // reviews bind to headSha so a new push voids a stale approval)
    expect(byName.prNumber?.type).toBe(EFieldType.number)
    expect(byName.headSha?.type).toBe(EFieldType.string)
    // Required provenance
    expect(byName.title?.required).toBe(true)
    expect(byName.description?.required).toBe(true)
    expect(byName.createdBy?.required).toBe(true)
  })
})

describe(`reconcileDevTeam`, () => {
  it(`creates the collection when absent, scoped to the ops project`, async () => {
    const { services, collections } = makeFakeServices()

    const summary = await reconcileDevTeam(services)

    expect(summary.collectionsCreated).toBe(1)
    expect(summary.collectionsUnchanged).toBe(0)
    expect(summary.errors).toBe(0)
    const created = collections.get(`${OpsProjectId}:dev_tasks`)
    expect(created).toBeDefined()
    expect(created.id).toBe(DevTeamCollectionDefs[0].id)
    expect(created.schema).toEqual(DevTeamCollectionDefs[0].schema)
  })

  it(`is idempotent — a re-run reports unchanged and creates nothing`, async () => {
    const { services } = makeFakeServices()

    await reconcileDevTeam(services)
    const second = await reconcileDevTeam(services)

    expect(second.collectionsCreated).toBe(0)
    expect(second.collectionsUnchanged).toBe(1)
    expect(second.errors).toBe(0)
  })

  it(`captures a create failure in the summary without throwing`, async () => {
    const services = {
      collection: {
        getByName: async () => ({}),
        create: async () => ({ error: new Error(`boom`) }),
      },
    }

    const summary = await reconcileDevTeam(services)

    expect(summary.errors).toBe(1)
    expect(summary.results[0]).toEqual({
      name: `dev_tasks`,
      action: `error`,
      message: `create failed: boom`,
    })
  })
})

import { describe, it, expect } from 'vitest'

import { EFieldType } from '@tdsk/domain'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { reconcileDevLoop, DevLoopCollectionDefs } from '@TDB/seeds/dev-loop/collections'

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

describe(`DevLoopCollectionDefs`, () => {
  it(`defines the three workflow collections with unique names + stable ids`, () => {
    expect(DevLoopCollectionDefs).toHaveLength(3)
    const names = DevLoopCollectionDefs.map((c) => c.name)
    expect(names).toEqual([`task_proposals`, `verifications`, `escalations`])
    const ids = DevLoopCollectionDefs.map((c) => c.id)
    expect(new Set(ids).size).toBe(3)
    // Every id is a valid entity id (col_ prefix + 6 chars = 10-char nanoid shape).
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{10}$/)
  })

  it(`declares every schema field with a valid EFieldType`, () => {
    for (const def of DevLoopCollectionDefs) {
      expect(def.schema.length).toBeGreaterThan(0)
      for (const field of def.schema) {
        expect(field.name.length).toBeGreaterThan(0)
        expect(ValidFieldTypes.has(field.type)).toBe(true)
      }
    }
  })

  it(`task_proposals mirrors the task_proposals table columns 1:1 (agentId → proposedByAgentId)`, () => {
    const tp = DevLoopCollectionDefs.find((c) => c.name === `task_proposals`)!
    expect(tp.schema).toEqual([
      { name: `title`, type: EFieldType.string, required: true },
      { name: `description`, type: EFieldType.string, required: true },
      { name: `priority`, type: EFieldType.string },
      { name: `evidence`, type: EFieldType.string, required: true },
      { name: `sourceSignal`, type: EFieldType.string },
      { name: `dedupeKey`, type: EFieldType.string, required: true },
      { name: `repos`, type: EFieldType.array },
      { name: `status`, type: EFieldType.string, required: true },
      { name: `scanResult`, type: EFieldType.object },
      { name: `auditVerdict`, type: EFieldType.object },
      { name: `meta`, type: EFieldType.object },
      { name: `prUrl`, type: EFieldType.string },
      { name: `reason`, type: EFieldType.string },
      { name: `initiative`, type: EFieldType.string },
      { name: `parentId`, type: EFieldType.string },
      { name: `proposedByAgentId`, type: EFieldType.string, required: true },
    ])
  })

  it(`verifications mirrors the verifications table columns 1:1`, () => {
    const vf = DevLoopCollectionDefs.find((c) => c.name === `verifications`)!
    expect(vf.schema).toEqual([
      { name: `prNumber`, type: EFieldType.number, required: true },
      { name: `prUrl`, type: EFieldType.string },
      { name: `mergeSha`, type: EFieldType.string },
      { name: `probe`, type: EFieldType.object, required: true },
      { name: `status`, type: EFieldType.string, required: true },
      { name: `detail`, type: EFieldType.string },
      { name: `revertPrUrl`, type: EFieldType.string },
      { name: `escalationId`, type: EFieldType.string },
      { name: `meta`, type: EFieldType.object },
      { name: `agentId`, type: EFieldType.string, required: true },
    ])
  })

  it(`escalations mirrors the escalations table columns 1:1 (agentId → openedByAgentId)`, () => {
    const es = DevLoopCollectionDefs.find((c) => c.name === `escalations`)!
    expect(es.schema).toEqual([
      { name: `title`, type: EFieldType.string, required: true },
      { name: `problem`, type: EFieldType.string, required: true },
      { name: `evidence`, type: EFieldType.array },
      { name: `proposedPatch`, type: EFieldType.string },
      { name: `target`, type: EFieldType.string, required: true },
      { name: `status`, type: EFieldType.string, required: true },
      { name: `dedupeKey`, type: EFieldType.string, required: true },
      { name: `issueRef`, type: EFieldType.string },
      { name: `resolvedRef`, type: EFieldType.string },
      { name: `reason`, type: EFieldType.string },
      { name: `meta`, type: EFieldType.object },
      { name: `openedByAgentId`, type: EFieldType.string, required: true },
    ])
  })
})

describe(`reconcileDevLoop`, () => {
  it(`creates the 3 collections into the ops project with NO seed records`, async () => {
    const { services, collections } = makeFakeServices()

    const summary = await reconcileDevLoop(services)

    expect(summary).toMatchObject({
      collectionsCreated: 3,
      collectionsUnchanged: 0,
      errors: 0,
    })

    // All 3 collections exist under the ops project with their schemas.
    for (const def of DevLoopCollectionDefs) {
      const stored = collections.get(`${OpsProjectId}:${def.name}`)
      expect(stored).toBeDefined()
      expect(stored.projectId).toBe(OpsProjectId)
      expect(stored.schema).toEqual(def.schema)
    }

    // No record writes exist in the summary — collections only.
    expect(summary.results).toHaveLength(3)
    expect(summary.results.every((r) => r.action === `created`)).toBe(true)
  })

  it(`is idempotent — a re-run creates no new collections`, async () => {
    const { services, collections } = makeFakeServices()

    await reconcileDevLoop(services)
    const afterFirst = collections.size

    const second = await reconcileDevLoop(services)

    expect(second).toMatchObject({
      collectionsCreated: 0,
      collectionsUnchanged: 3,
      errors: 0,
    })
    expect(collections.size).toBe(afterFirst)
    expect(collections.size).toBe(3)
  })

  it(`defaults the target project to the ops project (pj_tIly2F1)`, async () => {
    const { services, collections } = makeFakeServices()
    await reconcileDevLoop(services)
    expect(OpsProjectId).toBe(`pj_tIly2F1`)
    expect(collections.get(`${OpsProjectId}:task_proposals`)).toBeDefined()
  })

  it(`records an error without throwing when a collection create fails`, async () => {
    const services = {
      collection: {
        getByName: async () => ({}),
        create: async () => ({ error: new Error(`boom`) }),
      },
    }
    const summary = await reconcileDevLoop(services as any)
    expect(summary.errors).toBe(3)
    expect(summary.collectionsCreated).toBe(0)
    expect(summary.results.every((r) => r.action === `error`)).toBe(true)
  })
})

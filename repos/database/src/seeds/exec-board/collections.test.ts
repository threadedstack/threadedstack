import { describe, it, expect } from 'vitest'

import { EFieldType } from '@tdsk/domain'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import {
  BoardCeoAgentId,
  BoardCtoAgentId,
  reconcileExecBoard,
  ExecBoardRecordSeeds,
  ExecBoardCollectionDefs,
} from '@TDB/seeds/exec-board/collections'

const ValidFieldTypes = new Set<string>(Object.values(EFieldType))

/**
 * An in-memory fake of the collection + record services that preserves the two
 * behaviors the reconcile depends on: getByName resolves an already-created
 * collection (project+name keyed), and record.upsert is create-or-replace by
 * id (so a re-run overwrites in place rather than inserting a duplicate). This
 * lets the pure reconcile be proven idempotent without a live DB.
 */
const makeFakeServices = () => {
  const collections = new Map<string, any>()
  const records = new Map<string, any>()

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
    record: {
      upsert: async (
        projectId: string,
        collectionName: string,
        input: { id?: string; data: Record<string, any> }
      ) => {
        const collection = collections.get(`${projectId}:${collectionName}`)
        if (!collection) return { error: new Error(`Collection not found`) }
        const id = input.id ?? `rec_${records.size}`
        // Create-or-replace by id — the record service's idempotent upsert.
        records.set(id, {
          id,
          projectId,
          collectionId: collection.id,
          data: input.data,
        })
        return { data: records.get(id) }
      },
    },
  }

  return { services, collections, records }
}

describe(`ExecBoardCollectionDefs`, () => {
  it(`defines the four board collections with unique names + stable ids`, () => {
    expect(ExecBoardCollectionDefs).toHaveLength(4)
    const names = ExecBoardCollectionDefs.map((c) => c.name)
    expect(names).toEqual([
      `board_members`,
      `decision_proposals`,
      `decision_positions`,
      `company_strategy`,
    ])
    const ids = ExecBoardCollectionDefs.map((c) => c.id)
    expect(new Set(ids).size).toBe(4)
    // Every id is a valid entity id (col_ prefix + 6 chars = 10-char nanoid shape).
    for (const id of ids) expect(id).toMatch(/^[A-Za-z0-9_-]{10}$/)
  })

  it(`declares every schema field with a valid EFieldType`, () => {
    for (const def of ExecBoardCollectionDefs) {
      expect(def.schema.length).toBeGreaterThan(0)
      for (const field of def.schema) {
        expect(field.name.length).toBeGreaterThan(0)
        expect(ValidFieldTypes.has(field.type)).toBe(true)
      }
    }
  })

  it(`board_members mirrors { agentId, role, isCEO } (membership-as-data)`, () => {
    const bm = ExecBoardCollectionDefs.find((c) => c.name === `board_members`)!
    expect(bm.schema).toEqual([
      { name: `agentId`, type: EFieldType.string, required: true },
      { name: `role`, type: EFieldType.string, required: true },
      { name: `isCEO`, type: EFieldType.boolean },
    ])
  })

  it(`decision_proposals mirrors the decision_proposals table columns 1:1`, () => {
    const dp = ExecBoardCollectionDefs.find((c) => c.name === `decision_proposals`)!
    expect(dp.schema).toEqual([
      { name: `title`, type: EFieldType.string, required: true },
      { name: `axis`, type: EFieldType.string, required: true },
      { name: `description`, type: EFieldType.string, required: true },
      { name: `evidence`, type: EFieldType.array, required: true },
      { name: `status`, type: EFieldType.string, required: true },
      { name: `round`, type: EFieldType.number, required: true },
      { name: `resolution`, type: EFieldType.string },
      { name: `resolvedRef`, type: EFieldType.string },
      { name: `openedByAgentId`, type: EFieldType.string, required: true },
    ])
  })

  it(`decision_positions mirrors the decision_positions table columns 1:1`, () => {
    const dp = ExecBoardCollectionDefs.find((c) => c.name === `decision_positions`)!
    expect(dp.schema).toEqual([
      { name: `proposalId`, type: EFieldType.string, required: true },
      { name: `agentId`, type: EFieldType.string, required: true },
      { name: `stance`, type: EFieldType.string, required: true },
      { name: `reasoning`, type: EFieldType.string, required: true },
      { name: `round`, type: EFieldType.number, required: true },
    ])
  })

  it(`company_strategy mirrors the company_strategies table columns 1:1`, () => {
    const cs = ExecBoardCollectionDefs.find((c) => c.name === `company_strategy`)!
    expect(cs.schema).toEqual([
      { name: `northStar`, type: EFieldType.string },
      { name: `segments`, type: EFieldType.array },
      { name: `positioning`, type: EFieldType.string },
      { name: `backlog`, type: EFieldType.array },
      { name: `activeInitiative`, type: EFieldType.object },
    ])
  })
})

describe(`ExecBoardRecordSeeds`, () => {
  it(`seeds two board members (CEO isCEO:true, CTO isCEO:false) + one strategy singleton`, () => {
    const members = ExecBoardRecordSeeds.filter((r) => r.collection === `board_members`)
    const strategy = ExecBoardRecordSeeds.filter(
      (r) => r.collection === `company_strategy`
    )
    expect(members).toHaveLength(2)
    expect(strategy).toHaveLength(1)

    const ceo = members.find((r) => r.data.role === `ceo`)!
    const cto = members.find((r) => r.data.role === `cto`)!
    expect(ceo.data).toEqual({ agentId: BoardCeoAgentId, role: `ceo`, isCEO: true })
    expect(cto.data).toEqual({ agentId: BoardCtoAgentId, role: `cto`, isCEO: false })
    // CEO id matches the seeded founder agent; CTO reuses the prod steward agent.
    expect(BoardCeoAgentId).toBe(`ag_ceo0001`)
    expect(BoardCtoAgentId).toBe(`ag_lvUbjp_`)

    // Strategy singleton is a valid empty-initial strategy.
    expect(strategy[0].data).toEqual({
      northStar: ``,
      segments: [],
      positioning: ``,
      backlog: [],
      activeInitiative: null,
    })

    // Every seed record carries a stable, valid entity id.
    for (const r of ExecBoardRecordSeeds) expect(r.id).toMatch(/^[A-Za-z0-9_-]{10}$/)
  })
})

describe(`reconcileExecBoard`, () => {
  it(`creates the 4 collections + upserts the 3 seed records into the exec project`, async () => {
    const { services, collections, records } = makeFakeServices()

    const summary = await reconcileExecBoard(services)

    expect(summary).toMatchObject({
      collectionsCreated: 4,
      collectionsUnchanged: 0,
      recordsUpserted: 3,
      errors: 0,
    })

    // All 4 collections exist under the exec project with their schemas.
    for (const def of ExecBoardCollectionDefs) {
      const stored = collections.get(`${OpsProjectId}:${def.name}`)
      expect(stored).toBeDefined()
      expect(stored.projectId).toBe(OpsProjectId)
      expect(stored.schema).toEqual(def.schema)
    }

    // 2 board_members + 1 company_strategy record present with the seeded data.
    expect(records.size).toBe(3)
    const byId = (id: string) => records.get(id)
    expect(byId(`rec_bmceo1`).data).toEqual({
      agentId: BoardCeoAgentId,
      role: `ceo`,
      isCEO: true,
    })
    expect(byId(`rec_bmcto1`).data).toEqual({
      agentId: BoardCtoAgentId,
      role: `cto`,
      isCEO: false,
    })
    expect(byId(`rec_strat1`).data).toEqual({
      northStar: ``,
      segments: [],
      positioning: ``,
      backlog: [],
      activeInitiative: null,
    })
  })

  it(`is idempotent — a re-run creates no new collections or records`, async () => {
    const { services, collections, records } = makeFakeServices()

    await reconcileExecBoard(services)
    const collectionsAfterFirst = collections.size
    const recordsAfterFirst = records.size

    const second = await reconcileExecBoard(services)

    // Re-run: nothing new created, all four collections reported unchanged.
    expect(second).toMatchObject({
      collectionsCreated: 0,
      collectionsUnchanged: 4,
      recordsUpserted: 3,
      errors: 0,
    })
    // Row counts are unchanged (records upsert in place by stable id).
    expect(collections.size).toBe(collectionsAfterFirst)
    expect(records.size).toBe(recordsAfterFirst)
    expect(collections.size).toBe(4)
    expect(records.size).toBe(3)
  })

  it(`defaults the target project to the exec project (pj_tIly2F1)`, async () => {
    const { services, collections } = makeFakeServices()
    await reconcileExecBoard(services)
    expect(OpsProjectId).toBe(`pj_tIly2F1`)
    expect(collections.get(`${OpsProjectId}:board_members`)).toBeDefined()
  })

  it(`records an error without throwing when a collection create fails`, async () => {
    const services = {
      collection: {
        getByName: async () => ({}),
        create: async () => ({ error: new Error(`boom`) }),
      },
      record: {
        upsert: async () => ({ data: {} }),
      },
    }
    const summary = await reconcileExecBoard(services as any)
    expect(summary.errors).toBe(4)
    expect(summary.collectionsCreated).toBe(0)
    expect(
      summary.results.every((r) => r.kind !== `collection` || r.action === `error`)
    ).toBe(true)
  })
})

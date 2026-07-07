import { CompanyStrategy } from './companyStrategy'
import { PgDialect } from 'drizzle-orm/pg-core'
import { CompanyStrategy as CompanyStrategyModel, EInitiativeStatus } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const dialect = new PgDialect()
const render = (chunk: any) => dialect.sqlToQuery(chunk)

/**
 * Mock Drizzle DB covering the chains the service uses:
 *   select→from→where→limit                        (getByOrg)
 *   insert→values→onConflictDoUpdate→returning      (upsertByOrg)
 *   update→set→where→returning                      (set/clearActiveInitiative)
 */
const createMockDb = () => {
  const limitFn = vi.fn((..._args: any[]) => Promise.resolve([]))
  const selWhereFn = vi.fn((..._args: any[]) => ({ limit: limitFn }))
  const fromFn = vi.fn((..._args: any[]) => ({ where: selWhereFn }))
  const selectFn = vi.fn((..._args: any[]) => ({ from: fromFn }))

  const insReturningFn = vi.fn((..._args: any[]) => Promise.resolve([]))
  const onConflictFn = vi.fn((..._args: any[]) => ({ returning: insReturningFn }))
  const valuesFn = vi.fn((..._args: any[]) => ({
    onConflictDoUpdate: onConflictFn,
    returning: insReturningFn,
  }))
  const insertFn = vi.fn((..._args: any[]) => ({ values: valuesFn }))

  const updReturningFn = vi.fn((..._args: any[]) => Promise.resolve([]))
  const updWhereFn = vi.fn((..._args: any[]) => ({ returning: updReturningFn }))
  const setFn = vi.fn((..._args: any[]) => ({ where: updWhereFn }))
  const updateFn = vi.fn((..._args: any[]) => ({ set: setFn }))

  return {
    db: { select: selectFn, insert: insertFn, update: updateFn } as any,
    limitFn,
    selWhereFn,
    insReturningFn,
    onConflictFn,
    valuesFn,
    setFn,
    updWhereFn,
    updReturningFn,
  }
}

const fakeRow = (overrides: Record<string, any> = {}) => ({
  id: `cs_abc1234`,
  orgId: `og_org0001`,
  northStar: `The nervous system between AI models and the world`,
  segments: [`AI-native startups`],
  positioning: `Unified auth + compute + secure proxy`,
  backlog: [],
  activeInitiative: null,
  updatedByAgentId: `ag_ceo0001`,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`CompanyStrategy service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: CompanyStrategy

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new CompanyStrategy({ db: mocks.db, config: {} } as any)
  })

  it(`instantiates against the company_strategies table`, () => {
    expect(service).toBeInstanceOf(CompanyStrategy)
    expect(service.name).toBe(`companyStrategies`)
  })

  describe(`getByOrg`, () => {
    it(`returns the modeled row when one exists`, async () => {
      mocks.limitFn.mockResolvedValueOnce([fakeRow()])
      const result = await service.getByOrg(`og_org0001`)

      const where = render(mocks.selWhereFn.mock.calls[0][0])
      expect(where.params).toContain(`og_org0001`)
      expect(result.data).toBeInstanceOf(CompanyStrategyModel)
    })

    it(`returns {} when the org has no strategy row`, async () => {
      mocks.limitFn.mockResolvedValueOnce([])
      const result = await service.getByOrg(`og_org0001`)
      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
    })
  })

  describe(`upsertByOrg`, () => {
    it(`inserts keyed by orgId and conflicts on org_id to patch the same row`, async () => {
      mocks.insReturningFn.mockResolvedValueOnce([
        fakeRow({ positioning: `New positioning` }),
      ])

      const result = await service.upsertByOrg(`og_org0001`, {
        positioning: `New positioning`,
      })

      // values carry the orgId + the patch
      expect(mocks.valuesFn.mock.calls[0][0]).toMatchObject({
        orgId: `og_org0001`,
        positioning: `New positioning`,
      })
      // conflict target is the org_id column; the patch is applied on update
      const conflictArg = mocks.onConflictFn.mock.calls[0][0]
      expect(conflictArg.set.positioning).toBe(`New positioning`)
      expect(result.data).toBeInstanceOf(CompanyStrategyModel)
      expect(result.data?.positioning).toBe(`New positioning`)
    })
  })

  describe(`setActiveInitiative`, () => {
    it(`freezes the initiative fields onto the strategy row`, async () => {
      const initiative = {
        title: `Ship sandbox marketplace v1`,
        definitionOfDone: `All tasks merged + deployed + verified`,
        evidence: [],
        status: EInitiativeStatus.active,
        committedAt: new Date(),
      }
      mocks.updReturningFn.mockResolvedValueOnce([
        fakeRow({ activeInitiative: initiative }),
      ])

      const result = await service.setActiveInitiative(`og_org0001`, initiative)

      expect(mocks.setFn.mock.calls[0][0].activeInitiative).toEqual(initiative)
      const where = render(mocks.updWhereFn.mock.calls[0][0])
      expect(where.params).toContain(`og_org0001`)
      expect(result.data?.activeInitiative).toEqual(initiative)
    })

    it(`returns {} when no strategy row matched`, async () => {
      mocks.updReturningFn.mockResolvedValueOnce([])
      const result = await service.setActiveInitiative(`og_org0001`, {
        title: `x`,
        definitionOfDone: `y`,
        evidence: [],
        status: EInitiativeStatus.active,
        committedAt: new Date(),
      })
      expect(result.data).toBeUndefined()
    })
  })

  describe(`clearActiveInitiative`, () => {
    it(`nulls the Active Initiative`, async () => {
      mocks.updReturningFn.mockResolvedValueOnce([fakeRow({ activeInitiative: null })])
      const result = await service.clearActiveInitiative(`og_org0001`)
      expect(mocks.setFn.mock.calls[0][0].activeInitiative).toBeNull()
      expect(result.data?.activeInitiative).toBeNull()
    })
  })

  describe(`promoteNextFromBacklog`, () => {
    it(`moves the top backlog item to the Active Initiative and drops it from the backlog`, async () => {
      const item1 = {
        title: `Sandbox marketplace`,
        rationale: `Distribution wedge`,
        priority: 1,
      }
      const item2 = {
        title: `Usage-based pricing`,
        rationale: `Aligns cost to value`,
        priority: 2,
      }

      // getByOrg → strategy with a two-item backlog and no active initiative
      mocks.limitFn.mockResolvedValueOnce([
        fakeRow({ backlog: [item1, item2], activeInitiative: null }),
      ])
      // upsertByOrg → the updated row
      mocks.insReturningFn.mockResolvedValueOnce([
        fakeRow({
          backlog: [item2],
          activeInitiative: {
            title: item1.title,
            definitionOfDone: item1.rationale,
            evidence: [],
            status: EInitiativeStatus.active,
            committedAt: new Date(),
          },
        }),
      ])

      const result = await service.promoteNextFromBacklog(`og_org0001`)

      // The upsert values carry the promoted initiative + the trimmed backlog
      const upsertValues = mocks.valuesFn.mock.calls[0][0]
      expect(upsertValues.activeInitiative.title).toBe(item1.title)
      expect(upsertValues.activeInitiative.definitionOfDone).toBe(item1.rationale)
      expect(upsertValues.activeInitiative.status).toBe(EInitiativeStatus.active)
      expect(upsertValues.backlog).toEqual([item2])

      expect(result.data?.activeInitiative?.title).toBe(item1.title)
      expect(result.data?.backlog).toEqual([item2])
    })

    it(`returns the strategy unchanged when the backlog is empty`, async () => {
      mocks.limitFn.mockResolvedValueOnce([fakeRow({ backlog: [] })])
      const result = await service.promoteNextFromBacklog(`og_org0001`)
      // no upsert attempted
      expect(mocks.valuesFn).not.toHaveBeenCalled()
      expect(result.data).toBeInstanceOf(CompanyStrategyModel)
      expect(result.data?.backlog).toEqual([])
    })

    it(`returns {} when the org has no strategy row`, async () => {
      mocks.limitFn.mockResolvedValueOnce([])
      const result = await service.promoteNextFromBacklog(`og_org0001`)
      expect(result.data).toBeUndefined()
    })
  })
})

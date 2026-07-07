import { DecisionPosition } from './decisionPosition'
import { PgDialect } from 'drizzle-orm/pg-core'
import { DecisionPosition as DecisionPositionModel, EStance } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const dialect = new PgDialect()
const render = (chunk: any) => dialect.sqlToQuery(chunk)

/**
 * Mock Drizzle DB for the chains the service uses:
 *   select→from→where→orderBy  (listByProposal / latestByProposal)
 *   insert→values→returning     (create, via Base)
 */
const createMockDb = () => {
  const orderByFn = vi.fn((..._args: any[]) => Promise.resolve([]))
  const selWhereFn = vi.fn((..._args: any[]) => ({ orderBy: orderByFn }))
  const fromFn = vi.fn((..._args: any[]) => ({ where: selWhereFn }))
  const selectFn = vi.fn((..._args: any[]) => ({ from: fromFn }))

  const insReturningFn = vi.fn((..._args: any[]) => Promise.resolve([]))
  const valuesFn = vi.fn((..._args: any[]) => ({ returning: insReturningFn }))
  const insertFn = vi.fn((..._args: any[]) => ({ values: valuesFn }))

  return {
    db: { select: selectFn, insert: insertFn } as any,
    selectFn,
    fromFn,
    selWhereFn,
    orderByFn,
    insertFn,
    valuesFn,
    insReturningFn,
  }
}

const fakeRow = (overrides: Record<string, any> = {}) => ({
  id: `dpos_abc12`,
  orgId: `og_org0001`,
  proposalId: `dp_abc1234`,
  agentId: `ag_cto0001`,
  stance: EStance.endorse,
  reasoning: `Feasible in one initiative`,
  round: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`DecisionPosition service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: DecisionPosition

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new DecisionPosition({ db: mocks.db, config: {} } as any)
  })

  it(`instantiates against the decision_positions table`, () => {
    expect(service).toBeInstanceOf(DecisionPosition)
    expect(service.name).toBe(`decisionPositions`)
  })

  describe(`create`, () => {
    it(`inserts the position and returns a modeled row`, async () => {
      mocks.insReturningFn.mockResolvedValueOnce([fakeRow()])

      const input = {
        orgId: `og_org0001`,
        proposalId: `dp_abc1234`,
        agentId: `ag_cto0001`,
        stance: EStance.endorse,
        reasoning: `Feasible in one initiative`,
        round: 1,
      }
      const result = await service.create(input as any)

      expect(mocks.valuesFn).toHaveBeenCalledWith(input)
      expect(result.data).toBeInstanceOf(DecisionPositionModel)
    })

    it(`enforces one position per (proposal, agent, round): a duplicate is a 409`, async () => {
      mocks.insReturningFn.mockRejectedValueOnce({ cause: { code: `23505` } })
      const result = await service.create(fakeRow() as any)
      expect(result.status).toBe(409)
      expect(result.error).toBeDefined()
    })
  })

  describe(`listByProposal`, () => {
    it(`filters to the proposal and orders by round ascending`, async () => {
      mocks.orderByFn.mockResolvedValueOnce([
        fakeRow({ id: `dpos_r1`, round: 1 }),
        fakeRow({ id: `dpos_r2`, round: 2 }),
      ])

      const result = await service.listByProposal(`dp_abc1234`)

      const where = render(mocks.selWhereFn.mock.calls[0][0])
      expect(where.params).toContain(`dp_abc1234`)

      const orderBy = render(mocks.orderByFn.mock.calls[0][0])
      expect(orderBy.sql).toContain(`round`)
      expect(orderBy.sql).toContain(`asc`)

      expect(result.data).toHaveLength(2)
      expect(result.data?.every((r) => r instanceof DecisionPositionModel)).toBe(true)
    })
  })

  describe(`latestByProposal`, () => {
    it(`returns one row per agent at their highest round`, async () => {
      // Ascending order: agent A round1, agent B round1, agent A round2
      mocks.orderByFn.mockResolvedValueOnce([
        fakeRow({ id: `dpos_a1`, agentId: `ag_a`, round: 1, stance: EStance.object }),
        fakeRow({ id: `dpos_b1`, agentId: `ag_b`, round: 1, stance: EStance.endorse }),
        fakeRow({ id: `dpos_a2`, agentId: `ag_a`, round: 2, stance: EStance.endorse }),
      ])

      const result = await service.latestByProposal(`dp_abc1234`)

      // One entry per agent — A collapsed to its round-2 position
      expect(result.data).toHaveLength(2)
      const byAgent = Object.fromEntries((result.data ?? []).map((p) => [p.agentId, p]))
      expect(byAgent[`ag_a`].round).toBe(2)
      expect(byAgent[`ag_a`].stance).toBe(EStance.endorse)
      expect(byAgent[`ag_b`].round).toBe(1)
    })

    it(`returns an empty array when the proposal has no positions`, async () => {
      mocks.orderByFn.mockResolvedValueOnce([])
      const result = await service.latestByProposal(`dp_none`)
      expect(result.data).toEqual([])
    })
  })
})

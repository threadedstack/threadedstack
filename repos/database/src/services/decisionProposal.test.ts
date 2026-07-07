import { DecisionProposal } from './decisionProposal'
import { PgDialect } from 'drizzle-orm/pg-core'
import {
  DecisionProposal as DecisionProposalModel,
  EDecisionAxis,
  EDecisionStatus,
} from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const dialect = new PgDialect()
const render = (chunk: any) => dialect.sqlToQuery(chunk)

/**
 * Mock Drizzle DB covering the three chains the service uses:
 *   select→from→where→orderBy   (listByOrg / listOpenByOrg)
 *   insert→values→returning      (create, via Base)
 *   update→set→where→returning   (advanceRound)
 */
const createMockDb = () => {
  const orderByFn = vi.fn((..._args: any[]) => Promise.resolve([]))
  const selWhereFn = vi.fn((..._args: any[]) => ({ orderBy: orderByFn }))
  const fromFn = vi.fn((..._args: any[]) => ({ where: selWhereFn }))
  const selectFn = vi.fn((..._args: any[]) => ({ from: fromFn }))

  const insReturningFn = vi.fn((..._args: any[]) => Promise.resolve([]))
  const valuesFn = vi.fn((..._args: any[]) => ({ returning: insReturningFn }))
  const insertFn = vi.fn((..._args: any[]) => ({ values: valuesFn }))

  const updReturningFn = vi.fn((..._args: any[]) => Promise.resolve([]))
  const updWhereFn = vi.fn((..._args: any[]) => ({ returning: updReturningFn }))
  const setFn = vi.fn((..._args: any[]) => ({ where: updWhereFn }))
  const updateFn = vi.fn((..._args: any[]) => ({ set: setFn }))

  return {
    db: { select: selectFn, insert: insertFn, update: updateFn } as any,
    selectFn,
    fromFn,
    selWhereFn,
    orderByFn,
    insertFn,
    valuesFn,
    insReturningFn,
    updateFn,
    setFn,
    updWhereFn,
    updReturningFn,
  }
}

const fakeRow = (overrides: Record<string, any> = {}) => ({
  id: `dp_abc1234`,
  orgId: `og_org0001`,
  openedByAgentId: `ag_ceo0001`,
  title: `Move upmarket to mid-market teams`,
  axis: EDecisionAxis.segment,
  description: `Signups skew toward teams of 10-50`,
  evidence: [`https://metrics.example.com/signups`],
  status: EDecisionStatus.open,
  round: 1,
  resolution: null,
  resolvedRef: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`DecisionProposal service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: DecisionProposal

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new DecisionProposal({ db: mocks.db, config: {} } as any)
  })

  it(`instantiates against the decision_proposals table`, () => {
    expect(service).toBeInstanceOf(DecisionProposal)
    expect(service.name).toBe(`decisionProposals`)
  })

  describe(`create`, () => {
    it(`inserts the row and returns a modeled proposal`, async () => {
      mocks.insReturningFn.mockResolvedValueOnce([fakeRow()])

      const input = {
        orgId: `og_org0001`,
        openedByAgentId: `ag_ceo0001`,
        title: `Move upmarket to mid-market teams`,
        axis: EDecisionAxis.segment,
        description: `Signups skew toward teams of 10-50`,
      }
      const result = await service.create(input as any)

      expect(mocks.valuesFn).toHaveBeenCalledWith(input)
      expect(result.data).toBeInstanceOf(DecisionProposalModel)
      expect(result.data?.status).toBe(EDecisionStatus.open)
    })

    it(`classifies a unique-violation as a 409 conflict`, async () => {
      mocks.insReturningFn.mockRejectedValueOnce({ cause: { code: `23505` } })
      const result = await service.create(fakeRow() as any)
      expect(result.status).toBe(409)
      expect(result.error).toBeDefined()
    })
  })

  describe(`listByOrg`, () => {
    it(`filters to the org and orders newest first`, async () => {
      const newer = fakeRow({ id: `dp_new0001`, createdAt: new Date(`2026-07-03`) })
      const older = fakeRow({ id: `dp_old0001`, createdAt: new Date(`2026-07-01`) })
      mocks.orderByFn.mockResolvedValueOnce([newer, older])

      const result = await service.listByOrg(`og_org0001`)

      const where = render(mocks.selWhereFn.mock.calls[0][0])
      expect(where.params).toContain(`og_org0001`)

      const orderBy = render(mocks.orderByFn.mock.calls[0][0])
      expect(orderBy.sql).toContain(`created_at`)
      expect(orderBy.sql).toContain(`desc`)

      expect(result.data?.[0].id).toBe(`dp_new0001`)
      expect(result.data?.every((r) => r instanceof DecisionProposalModel)).toBe(true)
    })

    it(`returns an empty array when no rows match`, async () => {
      mocks.orderByFn.mockResolvedValueOnce([])
      const result = await service.listByOrg(`og_org0001`)
      expect(result.data).toEqual([])
    })
  })

  describe(`listOpenByOrg`, () => {
    it(`includes only open|deliberating rows, excluding resolved statuses`, async () => {
      mocks.orderByFn.mockResolvedValueOnce([
        fakeRow({ status: EDecisionStatus.open }),
        fakeRow({ id: `dp_delib01`, status: EDecisionStatus.deliberating }),
      ])

      const result = await service.listOpenByOrg(`og_org0001`)

      const where = render(mocks.selWhereFn.mock.calls[0][0])
      expect(where.params).toContain(`og_org0001`)
      expect(where.params).toContain(EDecisionStatus.open)
      expect(where.params).toContain(EDecisionStatus.deliberating)
      expect(where.params).not.toContain(EDecisionStatus.committed)
      expect(where.params).not.toContain(EDecisionStatus.rejected)

      expect(result.data).toHaveLength(2)
    })
  })

  describe(`advanceRound`, () => {
    it(`increments round, marks deliberating, and returns the updated proposal`, async () => {
      mocks.updReturningFn.mockResolvedValueOnce([
        fakeRow({ round: 2, status: EDecisionStatus.deliberating }),
      ])

      const result = await service.advanceRound(`dp_abc1234`)

      const setArg = mocks.setFn.mock.calls[0][0]
      expect(setArg.status).toBe(EDecisionStatus.deliberating)
      // round is a SQL increment expression
      expect(render(setArg.round).sql).toContain(`round`)

      const where = render(mocks.updWhereFn.mock.calls[0][0])
      expect(where.params).toContain(`dp_abc1234`)

      expect(result.data).toBeInstanceOf(DecisionProposalModel)
      expect(result.data?.round).toBe(2)
      expect(result.data?.status).toBe(EDecisionStatus.deliberating)
    })

    it(`returns {} when no row matched the id`, async () => {
      mocks.updReturningFn.mockResolvedValueOnce([])
      const result = await service.advanceRound(`dp_missing`)
      expect(result.data).toBeUndefined()
    })
  })
})

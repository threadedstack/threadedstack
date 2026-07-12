import { Escalation } from './escalation'
import { PgDialect } from 'drizzle-orm/pg-core'
import {
  Escalation as EscalationModel,
  EEscalationStatus,
  EEscalationTarget,
} from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const dialect = new PgDialect()
const render = (chunk: any) => dialect.sqlToQuery(chunk)

/**
 * Mock Drizzle DB covering the two chains the service drives directly:
 * select→from→where→orderBy(→limit) (list/dedupe lookups), and
 * insert().values().onConflictDoNothing().returning() (claimOpen).
 */
const createMockDb = () => {
  const limitFn = vi.fn((..._args: any[]) => Promise.resolve([]))
  const orderByFn = vi.fn((..._args: any[]) => {
    const res: any = Promise.resolve([])
    res.limit = limitFn
    return res
  })
  const whereFn = vi.fn((..._args: any[]) => ({ orderBy: orderByFn }))
  const fromFn = vi.fn((..._args: any[]) => ({ where: whereFn }))
  const selectFn = vi.fn((..._args: any[]) => ({ from: fromFn }))

  const insertReturningFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))
  const insertOnConflictDoNothingFn = vi.fn((..._args: any[]) => ({
    returning: insertReturningFn,
  }))
  const insertValuesFn = vi.fn((..._args: any[]) => ({
    onConflictDoNothing: insertOnConflictDoNothingFn,
  }))
  const insertFn = vi.fn((..._args: any[]) => ({ values: insertValuesFn }))

  return {
    db: { select: selectFn, insert: insertFn } as any,
    selectFn,
    fromFn,
    whereFn,
    orderByFn,
    limitFn,
    insertFn,
    insertValuesFn,
    insertOnConflictDoNothingFn,
    insertReturningFn,
  }
}

const fakeRow = (overrides: Record<string, any> = {}) => ({
  id: `es_abc1234`,
  orgId: `og_org0001`,
  agentId: `ag_agent01`,
  title: `secrets rotation needed`,
  problem: `API key for Stripe is approaching expiry`,
  evidence: [`log: 403 on /v1/charges`, `expiry: 2026-07-10`],
  proposedPatch: null,
  target: EEscalationTarget.secrets,
  dedupeKey: `secrets:stripe-key-expiry`,
  status: EEscalationStatus.open,
  issueRef: null,
  resolvedRef: null,
  reason: null,
  meta: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`Escalation service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: Escalation

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new Escalation({ db: mocks.db, config: {} } as any)
  })

  it(`instantiates against the escalations table`, () => {
    expect(service).toBeInstanceOf(Escalation)
    expect(service.name).toBe(`escalations`)
  })

  describe(`openByDedupeKey`, () => {
    it(`filters to only open|routed rows and models the match`, async () => {
      // DB filter yields the routed row (a same-key resolved row is excluded)
      mocks.limitFn.mockResolvedValueOnce([fakeRow({ status: EEscalationStatus.routed })])

      const result = await service.openByDedupeKey(
        `og_org0001`,
        `secrets:stripe-key-expiry`
      )

      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(`og_org0001`)
      expect(where.params).toContain(`secrets:stripe-key-expiry`)
      expect(where.params).toContain(EEscalationStatus.open)
      expect(where.params).toContain(EEscalationStatus.routed)
      // resolved / rejected escalations are never matched
      expect(where.params).not.toContain(EEscalationStatus.resolved)
      expect(where.params).not.toContain(EEscalationStatus.rejected)

      expect(mocks.limitFn).toHaveBeenCalledWith(1)
      expect(result.data).toBeInstanceOf(EscalationModel)
    })

    it(`returns null when only a resolved row exists (filter yields nothing)`, async () => {
      mocks.limitFn.mockResolvedValueOnce([])
      const result = await service.openByDedupeKey(
        `og_org0001`,
        `secrets:stripe-key-expiry`
      )
      expect(result.data).toBeNull()
    })

    it(`returns null when only a rejected row exists (filter yields nothing)`, async () => {
      mocks.limitFn.mockResolvedValueOnce([])
      const result = await service.openByDedupeKey(`og_org0001`, `infra:disk-full`)
      expect(result.data).toBeNull()
    })
  })

  describe(`listByStatus`, () => {
    it(`filters to the given status and orders newest first`, async () => {
      const older = fakeRow({
        id: `es_older001`,
        status: EEscalationStatus.routed,
        createdAt: new Date(`2026-07-01`),
      })
      const newer = fakeRow({
        id: `es_newer01`,
        status: EEscalationStatus.routed,
        createdAt: new Date(`2026-07-03`),
      })
      // Mock orderBy resolving (no .limit call here)
      mocks.orderByFn.mockResolvedValueOnce([newer, older])

      const result = await service.listByStatus(`og_org0001`, EEscalationStatus.routed)

      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(`og_org0001`)
      expect(where.params).toContain(EEscalationStatus.routed)

      // orderBy desc — newer row first
      expect(result.data?.[0].id).toBe(`es_newer01`)
      expect(result.data?.[1].id).toBe(`es_older001`)
    })

    it(`returns an empty array when no rows match`, async () => {
      mocks.orderByFn.mockResolvedValueOnce([])
      const result = await service.listByStatus(`og_org0001`, EEscalationStatus.resolved)
      expect(result.data).toEqual([])
    })

    it(`maps each row to an EscalationModel instance`, async () => {
      mocks.orderByFn.mockResolvedValueOnce([
        fakeRow({ id: `es_abc0001`, status: EEscalationStatus.open }),
        fakeRow({ id: `es_abc0002`, status: EEscalationStatus.open }),
      ])
      const result = await service.listByStatus(`og_org0001`, EEscalationStatus.open)
      expect(result.data?.every((r) => r instanceof EscalationModel)).toBe(true)
    })
  })

  describe(`claimOpen`, () => {
    const claimArgs = {
      orgId: `og_org0001`,
      agentId: `ag_agent01`,
      dedupeKey: `secrets:stripe-key-expiry`,
      target: EEscalationTarget.secrets,
      status: EEscalationStatus.open,
      title: `secrets rotation needed`,
      problem: `API key for Stripe is approaching expiry`,
      evidence: [],
      proposedPatch: null,
      issueRef: null,
      resolvedRef: null,
      reason: null,
      meta: null,
    } as any

    it(`inserts and returns the modeled row when the claim succeeds`, async () => {
      mocks.insertReturningFn.mockResolvedValueOnce([fakeRow()])

      const { data, error, conflict } = await service.claimOpen(claimArgs)

      expect(error).toBeUndefined()
      expect(conflict).toBeUndefined()
      expect(data).toBeInstanceOf(EscalationModel)
      expect(mocks.insertValuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ dedupeKey: `secrets:stripe-key-expiry` })
      )
      expect(mocks.insertOnConflictDoNothingFn).toHaveBeenCalled()
    })

    it(`simulates two concurrent callers racing the same dedupeKey — exactly one wins`, async () => {
      // Caller A's insert succeeds outright.
      mocks.insertReturningFn.mockResolvedValueOnce([fakeRow({ id: `es_callerA1` })])
      const winner = await service.claimOpen(claimArgs)

      expect(winner.conflict).toBeUndefined()
      expect(winner.data).toBeInstanceOf(EscalationModel)
      expect(winner.data?.id).toBe(`es_callerA1`)

      // Caller B's insert hits the partial unique index on
      // escalations(org_id, dedupe_key) WHERE status IN ('open','routed') —
      // ON CONFLICT DO NOTHING means zero rows come back, never a thrown error.
      mocks.insertReturningFn.mockResolvedValueOnce([])
      const loser = await service.claimOpen(claimArgs)

      expect(loser.error).toBeUndefined()
      expect(loser.data).toBeNull()
      expect(loser.conflict).toBe(true)
    })

    it(`returns { error } instead of throwing when the insert query fails`, async () => {
      mocks.insertReturningFn.mockRejectedValueOnce(new Error(`db down`))

      const { data, error, conflict } = await service.claimOpen(claimArgs)

      expect(data).toBeUndefined()
      expect(conflict).toBeUndefined()
      expect(error?.message).toBe(`db down`)
    })
  })
})

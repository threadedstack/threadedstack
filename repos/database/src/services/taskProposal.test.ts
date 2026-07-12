import { TaskProposal } from './taskProposal'
import { PgDialect } from 'drizzle-orm/pg-core'
import {
  TaskProposal as TaskProposalModel,
  ETaskPriority,
  ETaskProposalStatus,
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
  id: `tp_abc1234`,
  orgId: `og_org0001`,
  agentId: `ag_agent01`,
  title: `Fix red CI`,
  description: `The main pipeline is failing`,
  priority: ETaskPriority.P3,
  evidence: `build step exited 1`,
  sourceSignal: `ci`,
  dedupeKey: `ci:build:main`,
  repos: [],
  status: ETaskProposalStatus.scanned,
  scanResult: null,
  auditVerdict: null,
  prUrl: null,
  reason: null,
  parentId: null,
  initiative: null,
  meta: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`TaskProposal service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: TaskProposal

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new TaskProposal({ db: mocks.db, config: {} } as any)
  })

  it(`instantiates against the task_proposals table`, () => {
    expect(service).toBeInstanceOf(TaskProposal)
    expect(service.name).toBe(`taskProposals`)
  })

  describe(`findOpenByDedupeKey`, () => {
    it(`filters to only open (pending|scanned) rows and models the match`, async () => {
      // DB filter yields the scanned row (a same-key rejected row is excluded)
      mocks.limitFn.mockResolvedValueOnce([
        fakeRow({ status: ETaskProposalStatus.scanned }),
      ])

      const result = await service.findOpenByDedupeKey(`og_org0001`, `ci:build:main`)

      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(`og_org0001`)
      expect(where.params).toContain(`ci:build:main`)
      expect(where.params).toContain(ETaskProposalStatus.pending)
      expect(where.params).toContain(ETaskProposalStatus.scanned)
      // resolved / rejected proposals are never matched
      expect(where.params).not.toContain(ETaskProposalStatus.rejected)
      expect(where.params).not.toContain(ETaskProposalStatus.promoted)

      expect(mocks.limitFn).toHaveBeenCalledWith(1)
      expect(result.data).toBeInstanceOf(TaskProposalModel)
    })

    it(`returns null when only a rejected row exists (filter yields nothing)`, async () => {
      mocks.limitFn.mockResolvedValueOnce([])
      const result = await service.findOpenByDedupeKey(`og_org0001`, `ci:build:main`)
      expect(result.data).toBeNull()
    })
  })

  describe(`listBacklog`, () => {
    it(`filters to scanned and orders P0 before P3`, async () => {
      const p0 = fakeRow({ id: `tp_p0aaaa1`, priority: ETaskPriority.P0 })
      const p3 = fakeRow({ id: `tp_p3aaaa1`, priority: ETaskPriority.P3 })
      mocks.limitFn.mockResolvedValueOnce([p0, p3])

      const result = await service.listBacklog(`og_org0001`, 10)

      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(ETaskProposalStatus.scanned)

      const orderBy = render(mocks.orderByFn.mock.calls[0][0])
      expect(orderBy.sql).toContain(`priority`)
      expect(orderBy.sql).toContain(`asc`)

      expect(mocks.limitFn).toHaveBeenCalledWith(10)
      expect(result.data?.[0].priority).toBe(ETaskPriority.P0)
      expect(result.data?.[1].priority).toBe(ETaskPriority.P3)
    })
  })

  describe(`listByInitiative`, () => {
    it(`returns only rows for the given org + initiative in ascending createdAt order`, async () => {
      const t1 = fakeRow({
        id: `tp_init001`,
        orgId: `og_org0001`,
        initiative: `P4d ops tier`,
        createdAt: new Date(`2026-01-01T00:00:00Z`),
      })
      const t2 = fakeRow({
        id: `tp_init002`,
        orgId: `og_org0001`,
        initiative: `P4d ops tier`,
        createdAt: new Date(`2026-01-02T00:00:00Z`),
      })
      const t3 = fakeRow({
        id: `tp_init003`,
        orgId: `og_org0001`,
        initiative: `P4d ops tier`,
        createdAt: new Date(`2026-01-03T00:00:00Z`),
      })
      // The DB mock returns the pre-filtered + ordered rows — the where clause
      // excludes the 2 unrelated-initiative rows; only the 3 matching rows come back.
      mocks.orderByFn.mockResolvedValueOnce([t1, t2, t3])

      const result = await service.listByInitiative(`og_org0001`, `P4d ops tier`)

      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(`og_org0001`)
      expect(where.params).toContain(`P4d ops tier`)

      const orderBy = render(mocks.orderByFn.mock.calls[0][0])
      expect(orderBy.sql).toContain(`created_at`)
      expect(orderBy.sql).toContain(`asc`)

      expect(result.data).toHaveLength(3)
      expect(result.data?.[0].id).toBe(`tp_init001`)
      expect(result.data?.[1].id).toBe(`tp_init002`)
      expect(result.data?.[2].id).toBe(`tp_init003`)
      result.data?.forEach((row) => expect(row).toBeInstanceOf(TaskProposalModel))
    })

    it(`is org-scoped: a same-initiative row under a different orgId does not match`, async () => {
      // The where clause carries both orgId AND initiative — a different org's row
      // is filtered out at the DB level. Mock returns empty to simulate that.
      mocks.orderByFn.mockResolvedValueOnce([])

      const result = await service.listByInitiative(`og_org9999`, `P4d ops tier`)

      const where = render(mocks.whereFn.mock.calls[0][0])
      // Must scope to the requesting org, not the other org
      expect(where.params).toContain(`og_org9999`)
      expect(where.params).toContain(`P4d ops tier`)
      expect(where.params).not.toContain(`og_org0001`)

      expect(result.data).toHaveLength(0)
    })
  })

  describe(`listChildren`, () => {
    it(`returns only rows whose parentId matches, in ascending createdAt order`, async () => {
      const child1 = fakeRow({
        id: `tp_child01`,
        parentId: `tp_parent`,
        createdAt: new Date(`2026-02-01T00:00:00Z`),
      })
      const child2 = fakeRow({
        id: `tp_child02`,
        parentId: `tp_parent`,
        createdAt: new Date(`2026-02-02T00:00:00Z`),
      })
      const child3 = fakeRow({
        id: `tp_child03`,
        parentId: `tp_parent`,
        createdAt: new Date(`2026-02-03T00:00:00Z`),
      })
      // DB returns the 3 children; the 1 unrelated row is excluded by the where clause.
      mocks.orderByFn.mockResolvedValueOnce([child1, child2, child3])

      const result = await service.listChildren(`tp_parent`)

      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(`tp_parent`)

      const orderBy = render(mocks.orderByFn.mock.calls[0][0])
      expect(orderBy.sql).toContain(`created_at`)
      expect(orderBy.sql).toContain(`asc`)

      expect(result.data).toHaveLength(3)
      expect(result.data?.[0].id).toBe(`tp_child01`)
      expect(result.data?.[1].id).toBe(`tp_child02`)
      expect(result.data?.[2].id).toBe(`tp_child03`)
      result.data?.forEach((row) => expect(row).toBeInstanceOf(TaskProposalModel))
    })

    it(`returns an empty array when no children exist for the given parentId`, async () => {
      mocks.orderByFn.mockResolvedValueOnce([])

      const result = await service.listChildren(`tp_nochild`)

      const where = render(mocks.whereFn.mock.calls[0][0])
      expect(where.params).toContain(`tp_nochild`)

      expect(result.data).toEqual([])
    })

    it(`parent+children grouping smoke: listByInitiative returns all 4; listChildren returns only the 3 children`, async () => {
      const parent = fakeRow({
        id: `tp_smoke00`,
        orgId: `og_org0001`,
        initiative: `X`,
        parentId: null,
        createdAt: new Date(`2026-03-01T00:00:00Z`),
      })
      const c1 = fakeRow({
        id: `tp_smokec1`,
        orgId: `og_org0001`,
        initiative: `X`,
        parentId: `tp_smoke00`,
        createdAt: new Date(`2026-03-02T00:00:00Z`),
      })
      const c2 = fakeRow({
        id: `tp_smokec2`,
        orgId: `og_org0001`,
        initiative: `X`,
        parentId: `tp_smoke00`,
        createdAt: new Date(`2026-03-03T00:00:00Z`),
      })
      const c3 = fakeRow({
        id: `tp_smokec3`,
        orgId: `og_org0001`,
        initiative: `X`,
        parentId: `tp_smoke00`,
        createdAt: new Date(`2026-03-04T00:00:00Z`),
      })

      // First call: listByInitiative → all 4 rows (parent + 3 children)
      mocks.orderByFn.mockResolvedValueOnce([parent, c1, c2, c3])
      const byInit = await service.listByInitiative(`og_org0001`, `X`)
      expect(byInit.data).toHaveLength(4)
      expect(byInit.data?.map((r) => r.id)).toEqual([
        `tp_smoke00`,
        `tp_smokec1`,
        `tp_smokec2`,
        `tp_smokec3`,
      ])

      // Second call: listChildren → only the 3 children (parent excluded by parentId filter)
      mocks.orderByFn.mockResolvedValueOnce([c1, c2, c3])
      const children = await service.listChildren(`tp_smoke00`)
      expect(children.data).toHaveLength(3)
      expect(children.data?.map((r) => r.id)).toEqual([
        `tp_smokec1`,
        `tp_smokec2`,
        `tp_smokec3`,
      ])
    })
  })

  describe(`claimOpen`, () => {
    const claimArgs = {
      orgId: `og_org0001`,
      agentId: `ag_agent01`,
      title: `Fix red CI`,
      description: `The main pipeline is failing`,
      priority: ETaskPriority.P3,
      evidence: `build step exited 1`,
      sourceSignal: `ci`,
      dedupeKey: `ci:build:main`,
      repos: [],
      parentId: null,
      initiative: null,
      status: ETaskProposalStatus.scanned,
      scanResult: null,
      reason: null,
      meta: null,
    } as any

    it(`inserts and returns the modeled row when the claim succeeds`, async () => {
      mocks.insertReturningFn.mockResolvedValueOnce([fakeRow()])

      const { data, error, conflict } = await service.claimOpen(claimArgs)

      expect(error).toBeUndefined()
      expect(conflict).toBeUndefined()
      expect(data).toBeInstanceOf(TaskProposalModel)
      expect(mocks.insertValuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ dedupeKey: `ci:build:main` })
      )
      expect(mocks.insertOnConflictDoNothingFn).toHaveBeenCalled()
    })

    it(`simulates two concurrent callers racing the same dedupeKey — exactly one wins`, async () => {
      // Caller A's insert succeeds outright.
      mocks.insertReturningFn.mockResolvedValueOnce([fakeRow({ id: `tp_callerA1` })])
      const winner = await service.claimOpen(claimArgs)

      expect(winner.conflict).toBeUndefined()
      expect(winner.data).toBeInstanceOf(TaskProposalModel)
      expect(winner.data?.id).toBe(`tp_callerA1`)

      // Caller B's insert hits the partial unique index on
      // task_proposals(org_id, dedupe_key) WHERE status IN ('pending','scanned')
      // — ON CONFLICT DO NOTHING means zero rows come back, never a thrown error.
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

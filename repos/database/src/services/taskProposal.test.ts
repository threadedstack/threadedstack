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
 * Mock Drizzle DB for the select→from→where→orderBy(→limit) chain used by the
 * service. `orderBy` is awaitable (for the un-limited list helpers) and also
 * exposes `.limit` (for findOpenByDedupeKey / listBacklog).
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
  return {
    db: { select: selectFn } as any,
    selectFn,
    fromFn,
    whereFn,
    orderByFn,
    limitFn,
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
})

import { eq, lt, and } from 'drizzle-orm'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import type { Thread as ThreadService } from './thread'

// Mock the logger to avoid config/db initialization side-effects
vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// Mock drizzle-orm utilities
vi.mock(`drizzle-orm`, async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>(`drizzle-orm`)
  return {
    ...actual,
    eq: vi.fn((col, val) => ({ col, val, _tag: `eq` })),
    lt: vi.fn((col, val) => ({ col, val, _tag: `lt` })),
    and: vi.fn((...conds) => ({ conds, _tag: `and` })),
    desc: vi.fn((col) => ({ col, _tag: `desc` })),
    asc: vi.fn((col) => ({ col, _tag: `asc` })),
    getTableName: vi.fn(() => `threads`),
  }
})

vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

vi.mock(`@TDB/schemas/threads`, () => ({
  threads: {
    id: { name: `id` },
    agentId: { name: `agent_id` },
    userId: { name: `user_id` },
    orgId: { name: `org_id` },
    parentThreadId: { name: `parent_thread_id` },
    createdAt: { name: `created_at` },
  },
}))

vi.mock(`@TDB/schemas/messages`, () => ({
  messages: {
    id: { name: `id` },
    threadId: { name: `thread_id` },
    createdAt: { name: `created_at` },
  },
}))

// Mock the Thread domain model
vi.mock(`@tdsk/domain`, async () => {
  const orig = await vi.importActual(`@tdsk/domain`)
  return {
    ...orig,
    Thread: vi.fn(function MockThread(data: any) {
      return { ...data, id: data?.id || `mock-id`, _isModel: true }
    }),
  }
})

/**
 * Creates a mock Drizzle-compatible DB object mirroring the chained API
 * used by the Thread service, including the transaction-based branchThread
 * (its own insert().values().returning() chains for threads and messages).
 */
const createMockDb = () => {
  const findFirst = vi.fn()
  const findMany = vi.fn()

  const messagesFindFirst = vi.fn()
  const messagesFindMany = vi.fn()

  // tx.query.threads.findFirst / tx.query.messages.findMany
  const txThreadsFindFirst = vi.fn()
  const txMessagesFindMany = vi.fn()

  // tx.insert(threads).values(...).returning()
  const txThreadReturningFn = vi.fn()
  const txThreadValuesFn = vi.fn((..._args: any[]) => ({
    returning: txThreadReturningFn,
  }))

  // tx.insert(messages).values(...).returning()
  const txMessageReturningFn = vi.fn()
  const txMessageValuesFn = vi.fn((..._args: any[]) => ({
    returning: txMessageReturningFn,
  }))

  const txInsertFn = vi.fn((table: any) => {
    if (table === txMock.__messagesTable) return { values: txMessageValuesFn }
    return { values: txThreadValuesFn }
  })

  const txMock: any = {
    query: {
      threads: { findFirst: txThreadsFindFirst },
      messages: { findMany: txMessagesFindMany },
    },
    insert: txInsertFn,
    __messagesTable: undefined,
  }

  const transactionFn = vi.fn(async (cb: (tx: any) => Promise<any>) => cb(txMock))

  // db.delete(threads).where(...).returning({ id: threads.id }) — pruneExpiredThreads
  const deleteReturningFn = vi.fn().mockResolvedValue([])
  const deleteWhereFn = vi.fn(() => ({ returning: deleteReturningFn }))
  const deleteFn = vi.fn(() => ({ where: deleteWhereFn }))

  // db.services.org.list() / db.services.subscription.findByUser() — pruneExpiredThreads
  const orgListFn = vi.fn().mockResolvedValue({ data: [] })
  const subscriptionFindByUserFn = vi.fn().mockResolvedValue({})

  return {
    db: {
      transaction: transactionFn,
      delete: deleteFn,
      services: {
        org: { list: orgListFn },
        subscription: { findByUser: subscriptionFindByUserFn },
      },
      query: {
        threads: { findFirst, findMany },
        messages: { findFirst: messagesFindFirst, findMany: messagesFindMany },
      },
    } as any,
    findFirst,
    findMany,
    messagesFindFirst,
    messagesFindMany,
    transactionFn,
    txMock,
    txThreadsFindFirst,
    txMessagesFindMany,
    txThreadReturningFn,
    txThreadValuesFn,
    txMessageReturningFn,
    txMessageValuesFn,
    txInsertFn,
    deleteFn,
    deleteWhereFn,
    deleteReturningFn,
    orgListFn,
    subscriptionFindByUserFn,
  }
}

describe(`Thread service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: ThreadService

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks = createMockDb()

    const { Thread } = await import(`./thread`)
    service = new Thread({ db: mocks.db, config: {} as any })
    // Route inserts against the messages table to the message chain
    const { messages } = await import(`@TDB/schemas/messages`)
    mocks.txMock.__messagesTable = messages
  })

  // ---------- model() ----------
  describe(`model`, () => {
    it(`should create a ThreadModel with _isModel flag`, () => {
      const result = service.model({ id: `thread-1`, name: `Test` } as any)

      expect(result._isModel).toBe(true)
    })
  })

  // ---------- listByAgent() ----------
  describe(`listByAgent`, () => {
    it(`should return mapped thread models ordered by createdAt desc`, async () => {
      mocks.findMany.mockResolvedValue([
        { id: `thread-1`, agentId: `agent-1` },
        { id: `thread-2`, agentId: `agent-1` },
      ])

      const result = await service.listByAgent(`agent-1`)

      expect(result.data).toHaveLength(2)
      expect(result.data![0]._isModel).toBe(true)
      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ limit: undefined, offset: undefined })
      )
    })

    it(`should pass through limit/offset opts`, async () => {
      mocks.findMany.mockResolvedValue([])

      await service.listByAgent(`agent-1`, { limit: 10, offset: 5 })

      expect(mocks.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 10, offset: 5 })
      )
    })

    it(`should return error on db exception`, async () => {
      mocks.findMany.mockRejectedValue(new Error(`DB failure`))

      const result = await service.listByAgent(`agent-1`)

      expect(result.error).toBeDefined()
      expect(result.error!.message).toBe(`DB failure`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- listByUser() ----------
  describe(`listByUser`, () => {
    it(`should return mapped thread models`, async () => {
      mocks.findMany.mockResolvedValue([{ id: `thread-1`, userId: `user-1` }])

      const result = await service.listByUser(`user-1`)

      expect(result.data).toHaveLength(1)
      expect(result.data![0]._isModel).toBe(true)
    })

    it(`should return empty array when nothing found`, async () => {
      mocks.findMany.mockResolvedValue([])

      const result = await service.listByUser(`user-1`)

      expect(result.data).toEqual([])
    })

    it(`should return error on db exception`, async () => {
      mocks.findMany.mockRejectedValue(new Error(`DB failure`))

      const result = await service.listByUser(`user-1`)

      expect(result.error).toBeDefined()
      expect(result.error!.message).toBe(`DB failure`)
    })
  })

  // ---------- getWithMessages() ----------
  describe(`getWithMessages`, () => {
    it(`should return model data with messages included`, async () => {
      mocks.findFirst.mockResolvedValue({
        id: `thread-1`,
        messages: [{ id: `msg-1` }],
      })

      const result = await service.getWithMessages(`thread-1`)

      expect(result.data).toBeDefined()
      expect(result.data!._isModel).toBe(true)
      expect(result.error).toBeUndefined()
    })

    it(`should return an error when the thread is not found`, async () => {
      mocks.findFirst.mockResolvedValue(undefined)

      const result = await service.getWithMessages(`missing-id`)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeDefined()
      expect(result.error!.message).toBe(`Thread not found`)
    })

    it(`should return error on db exception`, async () => {
      mocks.findFirst.mockRejectedValue(new Error(`DB failure`))

      const result = await service.getWithMessages(`thread-1`)

      expect(result.error).toBeDefined()
      expect(result.error!.message).toBe(`DB failure`)
    })
  })

  // ---------- listBranches() ----------
  describe(`listBranches`, () => {
    it(`should return mapped branch thread models`, async () => {
      mocks.findMany.mockResolvedValue([{ id: `thread-2`, parentThreadId: `thread-1` }])

      const result = await service.listBranches(`thread-1`)

      expect(result.data).toHaveLength(1)
      expect(result.data![0]._isModel).toBe(true)
    })

    it(`should return error on db exception`, async () => {
      mocks.findMany.mockRejectedValue(new Error(`DB failure`))

      const result = await service.listBranches(`thread-1`)

      expect(result.error).toBeDefined()
      expect(result.error!.message).toBe(`DB failure`)
    })
  })

  // ---------- branchThread() ----------
  describe(`branchThread`, () => {
    it(`should return an empty result when the original thread is not found`, async () => {
      mocks.txThreadsFindFirst.mockResolvedValue(undefined)

      const result = await service.branchThread(`thread-1`, `msg-2`, `user-1`)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
      expect(mocks.txMessagesFindMany).not.toHaveBeenCalled()
    })

    it(`should return an empty result when the branch message is not part of the thread`, async () => {
      mocks.txThreadsFindFirst.mockResolvedValue({
        id: `thread-1`,
        name: `Original`,
        orgId: `org-1`,
      })
      mocks.txMessagesFindMany.mockResolvedValue([{ id: `msg-1` }])

      const result = await service.branchThread(`thread-1`, `msg-missing`, `user-1`)

      expect(result.data).toBeUndefined()
      expect(result.error).toBeUndefined()
      expect(mocks.txThreadValuesFn).not.toHaveBeenCalled()
    })

    it(`should create a branch thread copying only messages up to and including the branch point`, async () => {
      mocks.txThreadsFindFirst.mockResolvedValue({
        id: `thread-1`,
        name: `Original`,
        meta: { foo: `bar` },
        public: false,
        orgId: `org-1`,
        agentId: `agent-1`,
        projectId: `proj-1`,
        providerId: `prov-1`,
      })
      mocks.txMessagesFindMany.mockResolvedValue([
        { id: `msg-1`, type: `user`, content: `hi`, orgId: `org-1`, projectId: `proj-1` },
        {
          id: `msg-2`,
          type: `assistant`,
          content: `hey`,
          orgId: `org-1`,
          projectId: `proj-1`,
        },
        {
          id: `msg-3`,
          type: `user`,
          content: `later`,
          orgId: `org-1`,
          projectId: `proj-1`,
        },
      ])
      mocks.txThreadReturningFn.mockResolvedValue([
        { id: `thread-2`, name: `Original (branch)` },
      ])
      mocks.txMessageReturningFn.mockResolvedValue([
        { id: `msg-4`, threadId: `thread-2` },
        { id: `msg-5`, threadId: `thread-2` },
      ])

      const result = await service.branchThread(`thread-1`, `msg-2`, `user-1`)

      expect(result.error).toBeUndefined()
      expect(result.data).toBeDefined()
      expect(result.data!._isModel).toBe(true)
      expect(result.data!.messages).toHaveLength(2)

      expect(mocks.txThreadValuesFn).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: `user-1`,
          parentThreadId: `thread-1`,
          branchMessageId: `msg-2`,
          name: `Original (branch)`,
        })
      )

      // Only messages up to and including msg-2 are copied (2 of 3)
      expect(mocks.txMessageValuesFn).toHaveBeenCalledWith([
        expect.objectContaining({ threadId: `thread-2` }),
        expect.objectContaining({ threadId: `thread-2` }),
      ])
      expect(mocks.txMessageValuesFn.mock.calls[0][0]).toHaveLength(2)
    })

    it(`should default the branch name to "Untitled (branch)" when the original has no name`, async () => {
      mocks.txThreadsFindFirst.mockResolvedValue({ id: `thread-1`, orgId: `org-1` })
      mocks.txMessagesFindMany.mockResolvedValue([{ id: `msg-1` }])
      mocks.txThreadReturningFn.mockResolvedValue([{ id: `thread-2` }])
      mocks.txMessageReturningFn.mockResolvedValue([])

      await service.branchThread(`thread-1`, `msg-1`, `user-1`)

      expect(mocks.txThreadValuesFn).toHaveBeenCalledWith(
        expect.objectContaining({ name: `Untitled (branch)` })
      )
    })

    it(`should return an error when the transaction throws`, async () => {
      mocks.transactionFn.mockRejectedValue(new Error(`Transaction failed`))

      const result = await service.branchThread(`thread-1`, `msg-1`, `user-1`)

      expect(result.error).toBeDefined()
      expect(result.error!.message).toBe(`Transaction failed`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- pruneExpiredThreads() ----------
  describe(`pruneExpiredThreads`, () => {
    const Now = new Date(`2026-01-15T00:00:00.000Z`)
    const daysMs = (days: number) => days * 24 * 60 * 60 * 1000

    beforeEach(() => {
      vi.useFakeTimers()
      vi.setSystemTime(Now)
    })

    afterEach(() => {
      vi.useRealTimers()
    })

    it(`deletes threads older than the free-tier (7-day) window when the org has no subscription row`, async () => {
      mocks.orgListFn.mockResolvedValue({ data: [{ id: `org-1`, ownerId: `user-1` }] })
      mocks.subscriptionFindByUserFn.mockResolvedValue({})
      mocks.deleteReturningFn.mockResolvedValue([{ id: `thread-old-1` }])

      const result = await service.pruneExpiredThreads()

      expect(result).toEqual([{ orgId: `org-1`, deletedThreadIds: [`thread-old-1`] }])
      expect(mocks.subscriptionFindByUserFn).toHaveBeenCalledWith(`user-1`)
      const [, cutoffArg] = vi.mocked(lt).mock.calls[0]!
      expect(cutoffArg).toEqual(new Date(Now.getTime() - daysMs(7)))
      // The deletion must be genuinely scoped to this org, not merely
      // returning per-org results from an unscoped delete across all orgs.
      const { threads } = await import(`@TDB/schemas/threads`)
      expect(vi.mocked(eq).mock.calls[0]).toEqual([threads.orgId, `org-1`])
      expect(vi.mocked(and)).toHaveBeenCalledWith(
        vi.mocked(eq).mock.results[0]!.value,
        vi.mocked(lt).mock.results[0]!.value
      )
    })

    it(`defaults to the free tier when the org has no ownerId at all (never calls subscription lookup)`, async () => {
      mocks.orgListFn.mockResolvedValue({ data: [{ id: `org-1`, ownerId: null }] })
      mocks.deleteReturningFn.mockResolvedValue([{ id: `thread-1` }])

      await service.pruneExpiredThreads()

      expect(mocks.subscriptionFindByUserFn).not.toHaveBeenCalled()
      const [, cutoffArg] = vi.mocked(lt).mock.calls[0]!
      expect(cutoffArg).toEqual(new Date(Now.getTime() - daysMs(7)))
    })

    it.each([
      [`free`, 7],
      [`solo`, 30],
      [`pro`, 90],
      [`team`, 365],
    ])(`uses the %s tier's %d-day retention window`, async (tier, days) => {
      mocks.orgListFn.mockResolvedValue({ data: [{ id: `org-1`, ownerId: `user-1` }] })
      mocks.subscriptionFindByUserFn.mockResolvedValue({ data: { tier } })
      mocks.deleteReturningFn.mockResolvedValue([])

      await service.pruneExpiredThreads()

      const [, cutoffArg] = vi.mocked(lt).mock.calls[0]!
      expect(cutoffArg).toEqual(new Date(Now.getTime() - daysMs(days)))
    })

    it(`a thread within the window is left untouched -- an org with zero deletions is omitted from the results`, async () => {
      mocks.orgListFn.mockResolvedValue({ data: [{ id: `org-1`, ownerId: `user-1` }] })
      mocks.subscriptionFindByUserFn.mockResolvedValue({ data: { tier: `pro` } })
      mocks.deleteReturningFn.mockResolvedValue([])

      const result = await service.pruneExpiredThreads()

      expect(result).toEqual([])
    })

    it(`processes multiple orgs independently, each using its own owner's tier`, async () => {
      mocks.orgListFn.mockResolvedValue({
        data: [
          { id: `org-1`, ownerId: `user-1` },
          { id: `org-2`, ownerId: `user-2` },
        ],
      })
      mocks.subscriptionFindByUserFn.mockImplementation(async (userId: string) =>
        userId === `user-1` ? { data: { tier: `free` } } : { data: { tier: `team` } }
      )
      mocks.deleteReturningFn
        .mockResolvedValueOnce([{ id: `thread-a` }])
        .mockResolvedValueOnce([{ id: `thread-b` }, { id: `thread-c` }])

      const result = await service.pruneExpiredThreads()

      expect(result).toEqual([
        { orgId: `org-1`, deletedThreadIds: [`thread-a`] },
        { orgId: `org-2`, deletedThreadIds: [`thread-b`, `thread-c`] },
      ])
      expect(vi.mocked(lt).mock.calls[0]![1]).toEqual(new Date(Now.getTime() - daysMs(7)))
      expect(vi.mocked(lt).mock.calls[1]![1]).toEqual(
        new Date(Now.getTime() - daysMs(365))
      )
      // Each org's delete must be scoped to ITS OWN id -- proves the loop
      // never widens to an unscoped (or wrong-org) delete across iterations.
      const { threads } = await import(`@TDB/schemas/threads`)
      expect(vi.mocked(eq).mock.calls[0]).toEqual([threads.orgId, `org-1`])
      expect(vi.mocked(eq).mock.calls[1]).toEqual([threads.orgId, `org-2`])
    })

    it(`returns an empty array and never deletes when there are no orgs`, async () => {
      mocks.orgListFn.mockResolvedValue({ data: [] })

      const result = await service.pruneExpiredThreads()

      expect(result).toEqual([])
      expect(mocks.deleteFn).not.toHaveBeenCalled()
    })

    it(`returns an empty array when org.list() errors`, async () => {
      mocks.orgListFn.mockResolvedValue({ error: new Error(`boom`) })

      const result = await service.pruneExpiredThreads()

      expect(result).toEqual([])
      expect(mocks.deleteFn).not.toHaveBeenCalled()
    })
  })
})

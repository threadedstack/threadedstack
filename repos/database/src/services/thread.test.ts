import { describe, it, expect, vi, beforeEach } from 'vitest'
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

  return {
    db: {
      transaction: transactionFn,
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
})

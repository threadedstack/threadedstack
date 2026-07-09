import { Thread } from './thread'
import { threads } from '@TDB/schemas/threads'
import { messages } from '@TDB/schemas/messages'
import { Thread as ThreadModel } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the logger to avoid config/db initialization side-effects — its module
// load imports db.config, which throws in the env-less deploy test step (see
// apiKey.test.ts for the established pattern).
vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

/**
 * Mock Drizzle DB covering the chains thread.ts drives directly:
 * query.threads.findMany/findFirst, and a transaction(tx) callback that
 * drives tx.query.threads.findFirst, tx.query.messages.findMany, and
 * tx.insert(...).values(...).returning() for both threads and messages.
 */
const createMockDb = () => {
  const findManyFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))
  const findFirstFn = vi.fn((..._args: any[]) => Promise.resolve(undefined as any))

  const txThreadsFindFirstFn = vi.fn((..._args: any[]) =>
    Promise.resolve(undefined as any)
  )
  const txMessagesFindManyFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))

  const txThreadsReturningFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))
  const txThreadsValuesFn = vi.fn((..._args: any[]) => ({
    returning: txThreadsReturningFn,
  }))

  const txMessagesReturningFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))
  const txMessagesValuesFn = vi.fn((..._args: any[]) => ({
    returning: txMessagesReturningFn,
  }))

  // insert(threads) and insert(messages) are distinguished by which real
  // table object is passed in — resolve to the right values() mock either way.
  const txInsertFn = vi.fn((table: any) =>
    table === messages ? { values: txMessagesValuesFn } : { values: txThreadsValuesFn }
  )

  const txMock = {
    query: {
      threads: { findFirst: txThreadsFindFirstFn },
      messages: { findMany: txMessagesFindManyFn },
    },
    insert: txInsertFn,
  }
  const transactionFn = vi.fn(async (cb: any) => cb(txMock))

  return {
    db: {
      query: {
        threads: { findMany: findManyFn, findFirst: findFirstFn },
      },
      transaction: transactionFn,
    } as any,
    findManyFn,
    findFirstFn,
    txThreadsFindFirstFn,
    txMessagesFindManyFn,
    txThreadsValuesFn,
    txThreadsReturningFn,
    txMessagesValuesFn,
    txMessagesReturningFn,
    txInsertFn,
    transactionFn,
  }
}

const fakeThreadRow = (overrides: Record<string, any> = {}) => ({
  id: `th_thread001`,
  userId: `us_user00001`,
  orgId: `og_org00001`,
  projectId: `pj_proj0001`,
  agentId: `ag_agent0001`,
  providerId: `pv_provider1`,
  name: `Untitled`,
  meta: null,
  public: false,
  parentThreadId: null,
  branchMessageId: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

const fakeMessageRow = (overrides: Record<string, any> = {}) => ({
  id: `me_msg00001`,
  orgId: `og_org00001`,
  projectId: `pj_proj0001`,
  threadId: `th_thread001`,
  type: `user`,
  content: { text: `hi` },
  meta: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`Thread service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: Thread

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new Thread({ db: mocks.db, config: {} } as any)
  })

  describe(`listByAgent`, () => {
    it(`returns every thread for the agent, modeled`, async () => {
      mocks.findManyFn.mockResolvedValueOnce([
        fakeThreadRow({ id: `th_thread001` }),
        fakeThreadRow({ id: `th_thread002` }),
      ])

      const { data, error } = await service.listByAgent(`ag_agent0001`)

      expect(error).toBeUndefined()
      expect(data).toHaveLength(2)
      expect(data?.every((r) => r instanceof ThreadModel)).toBe(true)
    })

    it(`returns an empty array when the agent has no threads`, async () => {
      mocks.findManyFn.mockResolvedValueOnce([])

      const { data, error } = await service.listByAgent(`ag_agent0001`)

      expect(error).toBeUndefined()
      expect(data).toEqual([])
    })

    it(`returns { error } when the query throws`, async () => {
      const dbError = new Error(`db down`)
      mocks.findManyFn.mockRejectedValueOnce(dbError)

      const { data, error } = await service.listByAgent(`ag_agent0001`)

      expect(data).toBeUndefined()
      expect(error).toBe(dbError)
    })
  })

  describe(`listByUser`, () => {
    it(`returns every thread for the user, modeled`, async () => {
      mocks.findManyFn.mockResolvedValueOnce([fakeThreadRow()])

      const { data, error } = await service.listByUser(`us_user00001`)

      expect(error).toBeUndefined()
      expect(data).toHaveLength(1)
      expect(data?.[0]).toBeInstanceOf(ThreadModel)
    })

    it(`returns { error } when the query throws`, async () => {
      const dbError = new Error(`db down`)
      mocks.findManyFn.mockRejectedValueOnce(dbError)

      const { data, error } = await service.listByUser(`us_user00001`)

      expect(data).toBeUndefined()
      expect(error).toBe(dbError)
    })
  })

  describe(`getWithMessages`, () => {
    it(`returns the modeled thread when found`, async () => {
      mocks.findFirstFn.mockResolvedValueOnce(fakeThreadRow({ id: `th_thread001` }))

      const { data, error } = await service.getWithMessages(`th_thread001`)

      expect(error).toBeUndefined()
      expect(data).toBeInstanceOf(ThreadModel)
      expect(data?.id).toBe(`th_thread001`)
    })

    it(`returns { error } when the thread is not found`, async () => {
      mocks.findFirstFn.mockResolvedValueOnce(undefined)

      const { data, error } = await service.getWithMessages(`th_missing01`)

      expect(data).toBeUndefined()
      expect(error).toBeInstanceOf(Error)
      expect(error?.message).toBe(`Thread not found`)
    })

    it(`returns { error } when the query throws`, async () => {
      const dbError = new Error(`db down`)
      mocks.findFirstFn.mockRejectedValueOnce(dbError)

      const { data, error } = await service.getWithMessages(`th_thread001`)

      expect(data).toBeUndefined()
      expect(error).toBe(dbError)
    })
  })

  describe(`listBranches`, () => {
    it(`returns every branch of the thread, modeled`, async () => {
      mocks.findManyFn.mockResolvedValueOnce([
        fakeThreadRow({ parentThreadId: `th_thread001` }),
      ])

      const { data, error } = await service.listBranches(`th_thread001`)

      expect(error).toBeUndefined()
      expect(data).toHaveLength(1)
      expect(data?.[0]).toBeInstanceOf(ThreadModel)
    })

    it(`returns { error } when the query throws`, async () => {
      const dbError = new Error(`db down`)
      mocks.findManyFn.mockRejectedValueOnce(dbError)

      const { data, error } = await service.listBranches(`th_thread001`)

      expect(data).toBeUndefined()
      expect(error).toBe(dbError)
    })
  })

  describe(`branchThread`, () => {
    it(`copies messages up to and including the branch point into a new thread`, async () => {
      const original = fakeThreadRow({ id: `th_thread001`, name: `Original` })
      const allMessages = [
        fakeMessageRow({ id: `me_msg00001` }),
        fakeMessageRow({ id: `me_msg00002` }),
        fakeMessageRow({ id: `me_msg00003` }),
      ]
      mocks.txThreadsFindFirstFn.mockResolvedValueOnce(original)
      mocks.txMessagesFindManyFn.mockResolvedValueOnce(allMessages)
      const newThread = fakeThreadRow({
        id: `th_thread002`,
        name: `Original (branch)`,
        parentThreadId: `th_thread001`,
        branchMessageId: `me_msg00002`,
      })
      mocks.txThreadsReturningFn.mockResolvedValueOnce([newThread])
      mocks.txMessagesReturningFn.mockResolvedValueOnce([
        fakeMessageRow({ id: `me_msg00001`, threadId: `th_thread002` }),
        fakeMessageRow({ id: `me_msg00002`, threadId: `th_thread002` }),
      ])

      const { data, error } = await service.branchThread(
        `th_thread001`,
        `me_msg00002`,
        `us_user00001`
      )

      expect(error).toBeUndefined()
      expect(data).toBeInstanceOf(ThreadModel)
      expect(data?.id).toBe(`th_thread002`)
      // Only the two messages up to and including the branch point are copied.
      expect(data?.messages).toHaveLength(2)
      expect(mocks.txThreadsValuesFn).toHaveBeenCalledWith(
        expect.objectContaining({
          parentThreadId: `th_thread001`,
          branchMessageId: `me_msg00002`,
          userId: `us_user00001`,
        })
      )
    })

    it(`returns {} without inserting when the source thread does not exist`, async () => {
      mocks.txThreadsFindFirstFn.mockResolvedValueOnce(undefined)

      const result = await service.branchThread(
        `th_missing01`,
        `me_msg00001`,
        `us_user00001`
      )

      expect(result).toEqual({})
      expect(mocks.txInsertFn).not.toHaveBeenCalled()
    })

    it(`returns {} without inserting when the branch message is not in the thread`, async () => {
      mocks.txThreadsFindFirstFn.mockResolvedValueOnce(
        fakeThreadRow({ id: `th_thread001` })
      )
      mocks.txMessagesFindManyFn.mockResolvedValueOnce([
        fakeMessageRow({ id: `me_msg00001` }),
      ])

      const result = await service.branchThread(
        `th_thread001`,
        `me_nonexistent`,
        `us_user00001`
      )

      expect(result).toEqual({})
      expect(mocks.txInsertFn).not.toHaveBeenCalled()
    })

    it(`copies only the first message when branching at the very first message`, async () => {
      mocks.txThreadsFindFirstFn.mockResolvedValueOnce(
        fakeThreadRow({ id: `th_thread001` })
      )
      mocks.txMessagesFindManyFn.mockResolvedValueOnce([
        fakeMessageRow({ id: `me_msg00001` }),
        fakeMessageRow({ id: `me_msg00002` }),
      ])
      const newThread = fakeThreadRow({
        id: `th_thread002`,
        parentThreadId: `th_thread001`,
      })
      mocks.txThreadsReturningFn.mockResolvedValueOnce([newThread])
      mocks.txMessagesReturningFn.mockResolvedValueOnce([
        fakeMessageRow({ id: `me_msg00001`, threadId: `th_thread002` }),
      ])

      const { data, error } = await service.branchThread(
        `th_thread001`,
        `me_msg00001`,
        `us_user00001`
      )

      expect(error).toBeUndefined()
      expect(data?.messages).toHaveLength(1)
      expect(mocks.txMessagesValuesFn).toHaveBeenCalledWith([
        expect.objectContaining({ threadId: `th_thread002` }),
      ])
    })

    it(`returns { error } when the transaction throws`, async () => {
      const dbError = new Error(`transaction failed`)
      mocks.transactionFn.mockRejectedValueOnce(dbError)

      const { data, error } = await service.branchThread(
        `th_thread001`,
        `me_msg00001`,
        `us_user00001`
      )

      expect(data).toBeUndefined()
      expect(error).toBe(dbError)
    })
  })
})

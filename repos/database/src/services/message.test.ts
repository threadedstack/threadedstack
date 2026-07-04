import { Message } from './message'
import { PgDialect } from 'drizzle-orm/pg-core'
import { Message as MessageModel } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the logger to avoid config/db initialization side-effects
vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

const dialect = new PgDialect()
const render = (chunk: any) => dialect.sqlToQuery(chunk)

/**
 * Creates a mock Drizzle-compatible DB object.
 * Covers the chain pattern used by listRecentByAgent:
 *   select -> from -> innerJoin -> where -> orderBy -> limit
 */
const createMockDb = () => {
  const selectLimitFn = vi.fn((...args: any[]) => Promise.resolve([]))
  const selectOrderByFn = vi.fn((...args: any[]) => ({ limit: selectLimitFn }))
  const selectWhereFn = vi.fn((...args: any[]) => ({ orderBy: selectOrderByFn }))
  const innerJoinFn = vi.fn((...args: any[]) => ({ where: selectWhereFn }))
  const selectFromFn = vi.fn((...args: any[]) => ({ innerJoin: innerJoinFn }))
  const selectFn = vi.fn((...args: any[]) => ({ from: selectFromFn }))

  return {
    db: {
      select: selectFn,
      query: { messages: { findFirst: vi.fn(), findMany: vi.fn() } },
    } as any,
    selectFn,
    selectFromFn,
    innerJoinFn,
    selectWhereFn,
    selectOrderByFn,
    selectLimitFn,
  }
}

/**
 * Builds a fake message row that looks like what the DB would return.
 */
const fakeMessageRow = (overrides: Record<string, any> = {}) => ({
  id: `ms_abc1234`,
  type: `assistant`,
  content: [{ type: `text`, text: `Report complete` }],
  meta: null,
  orgId: `og_org0001`,
  projectId: null,
  threadId: `th_abc1234`,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`Message service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: Message

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new Message({ db: mocks.db, config: {} } as any)
  })

  // ---------- listRecentByAgent ----------
  describe(`listRecentByAgent`, () => {
    it(`should join threads and filter by the agent id`, async () => {
      const rows = [
        { message: fakeMessageRow({ id: `ms_aaa1111` }) },
        { message: fakeMessageRow({ id: `ms_bbb2222`, threadId: `th_def5678` }) },
      ]
      mocks.selectLimitFn.mockResolvedValue(rows)

      const result = await service.listRecentByAgent(`ag_agent01`)

      // joins on messages.threadId = threads.id
      const joinCond = render(mocks.innerJoinFn.mock.calls[0][1])
      expect(joinCond.sql).toContain(`thread_id`)

      // filters on threads.agentId
      const where = render(mocks.selectWhereFn.mock.calls[0][0])
      expect(where.sql).toContain(`agent_id`)
      expect(where.params).toContain(`ag_agent01`)

      expect(mocks.selectLimitFn).toHaveBeenCalledWith(50)
      expect(result.data).toHaveLength(2)
      expect(result.data?.[0]).toBeInstanceOf(MessageModel)
      expect(result.data?.[0].id).toBe(`ms_aaa1111`)
      expect(result.data?.[1].threadId).toBe(`th_def5678`)
    })

    it(`should accept a custom limit`, async () => {
      mocks.selectLimitFn.mockResolvedValue([])

      const result = await service.listRecentByAgent(`ag_agent01`, 10)

      expect(mocks.selectLimitFn).toHaveBeenCalledWith(10)
      expect(result.data).toEqual([])
    })

    it(`should return the error when the query throws`, async () => {
      mocks.selectLimitFn.mockRejectedValue(new Error(`query failed`))

      const result = await service.listRecentByAgent(`ag_agent01`)

      expect(result.data).toBeUndefined()
      expect(result.error?.message).toBe(`query failed`)
    })
  })
})

import { ApiKey } from './apiKey'
import { PgDialect } from 'drizzle-orm/pg-core'
import { ApiKey as ApiKeyModel } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the logger to avoid config/db initialization side-effects — its module
// load imports db.config, which throws in the env-less deploy test step.
vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

const dialect = new PgDialect()
const render = (chunk: any) => dialect.sqlToQuery(chunk)

/**
 * Mock Drizzle DB for the select→from→where chain used by getByResidentAgent
 * and getByHash (both await the where node directly).
 */
const createMockDb = () => {
  const whereFn = vi.fn((..._args: any[]) => Promise.resolve([] as any[]))
  const fromFn = vi.fn((..._args: any[]) => ({ where: whereFn }))
  const selectFn = vi.fn((..._args: any[]) => ({ from: fromFn }))
  return {
    db: { select: selectFn } as any,
    selectFn,
    fromFn,
    whereFn,
  }
}

const fakeRow = (overrides: Record<string, any> = {}) => ({
  id: `ak_key00001`,
  name: `resident:ag_agent001`,
  orgId: `og_org00001`,
  userId: null,
  projectId: null,
  keyHash: `hash-1`,
  keyPrefix: `tdsk_abc`,
  active: true,
  rateLimit: 100,
  permissions: [],
  expiresAt: null,
  lastUsedAt: null,
  residentAgentId: `ag_agent001`,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`ApiKey service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: ApiKey

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new ApiKey({ db: mocks.db, config: {} } as any)
  })

  describe(`getByResidentAgent`, () => {
    it(`filters on residentAgentId AND active and models the rows`, async () => {
      mocks.whereFn.mockResolvedValueOnce([fakeRow()])

      const { data, error } = await service.getByResidentAgent(`ag_agent001`)

      expect(error).toBeUndefined()
      expect(data).toHaveLength(1)
      expect(data?.[0]).toBeInstanceOf(ApiKeyModel)
      expect(data?.[0].residentAgentId).toBe(`ag_agent001`)

      const whereSql = render(mocks.whereFn.mock.calls[0][0]).sql
      expect(whereSql).toContain(`resident_agent_id`)
      expect(whereSql).toContain(`active`)
    })

    it(`returns an empty list when no active resident key exists`, async () => {
      mocks.whereFn.mockResolvedValueOnce([])

      const { data, error } = await service.getByResidentAgent(`ag_agent001`)

      expect(error).toBeUndefined()
      expect(data).toEqual([])
    })

    it(`returns { error } instead of throwing when the query fails`, async () => {
      mocks.whereFn.mockRejectedValueOnce(new Error(`db down`))

      const { data, error } = await service.getByResidentAgent(`ag_agent001`)

      expect(data).toBeUndefined()
      expect(error?.message).toBe(`db down`)
    })
  })
})

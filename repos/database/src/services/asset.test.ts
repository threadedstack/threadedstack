import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Asset as AssetService } from './asset'

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
    getTableName: vi.fn(() => `assets`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the assets schema
vi.mock(`@TDB/schemas/assets`, () => ({
  assets: {
    id: { name: `id` },
    name: { name: `name` },
    threadId: { name: `thread_id` },
    messageId: { name: `message_id` },
  },
}))

// Mock the domain model - AssetModel is a data class, not JS constructor collision
vi.mock(`@tdsk/domain`, async () => {
  const orig = await vi.importActual(`@tdsk/domain`)
  return {
    ...orig,
    Asset: vi.fn(function MockAssetModel(data: any) {
      return { ...data, _isModel: true }
    }),
  }
})

/**
 * Creates a mock Drizzle-compatible DB object.
 * Mirrors the chained API used by listByThread/listByMessage.
 */
const createMockDb = () => {
  const findMany = vi.fn()

  return {
    db: {
      query: {
        assets: { findMany },
      },
    } as any,
    findMany,
  }
}

describe(`Asset service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: AssetService

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks = createMockDb()

    const mod = await import(`./asset`)
    service = new mod.Asset({
      db: mocks.db,
      config: {} as any,
    })
  })

  describe(`with`, () => {
    it(`should spread the passed opts`, () => {
      expect(service.with({ foo: `bar` } as any)).toEqual({ foo: `bar` })
    })

    it(`should return undefined when opts are undefined`, () => {
      expect(service.with(undefined)).toBeUndefined()
    })
  })

  describe(`model`, () => {
    it(`should wrap the row in an AssetModel instance`, () => {
      const row = { id: `ast_1`, name: `myAsset` } as any
      const result = service.model(row)

      expect(result._isModel).toBe(true)
      expect(result.id).toBe(`ast_1`)
    })
  })

  describe(`listByThread`, () => {
    it(`should return assets mapped from the thread query`, async () => {
      const rows = [
        { id: `ast_1`, threadId: `th_1` },
        { id: `ast_2`, threadId: `th_1` },
      ]
      mocks.findMany.mockResolvedValue(rows)

      const result = await service.listByThread(`th_1`)

      expect(mocks.findMany).toHaveBeenCalledWith({
        where: { col: { name: `thread_id` }, val: `th_1`, _tag: `eq` },
      })
      expect(result.data).toHaveLength(2)
      expect(result.data[0]._isModel).toBe(true)
      expect(result.data[0].id).toBe(`ast_1`)
      expect(result.data[1].id).toBe(`ast_2`)
    })

    it(`should return the error without throwing on DB exception`, async () => {
      const dbError = new Error(`query failed`)
      mocks.findMany.mockRejectedValue(dbError)

      const result = await service.listByThread(`th_1`)

      expect(result).toEqual({ error: dbError })
    })
  })

  describe(`listByMessage`, () => {
    it(`should return assets mapped from the message query`, async () => {
      const rows = [{ id: `ast_3`, messageId: `msg_1` }]
      mocks.findMany.mockResolvedValue(rows)

      const result = await service.listByMessage(`msg_1`)

      expect(mocks.findMany).toHaveBeenCalledWith({
        where: { col: { name: `message_id` }, val: `msg_1`, _tag: `eq` },
      })
      expect(result.data).toHaveLength(1)
      expect(result.data[0]._isModel).toBe(true)
      expect(result.data[0].id).toBe(`ast_3`)
    })

    it(`should return the error without throwing on DB exception`, async () => {
      const dbError = new Error(`query failed`)
      mocks.findMany.mockRejectedValue(dbError)

      const result = await service.listByMessage(`msg_1`)

      expect(result).toEqual({ error: dbError })
    })
  })
})

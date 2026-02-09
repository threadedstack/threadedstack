import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Base } from './base'

// Mock the logger to avoid config/db initialization side-effects
vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// Mock drizzle-orm utilities
vi.mock(`drizzle-orm`, async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>(`drizzle-orm`)
  return {
    ...actual,
    // Simple eq mock that returns the args for assertion
    eq: vi.fn((col, val) => ({ col, val, _tag: `eq` })),
    and: vi.fn((...args) => args),
    getTableName: vi.fn(() => `test_table`),
  }
})

// Mock buildQuery helpers (not needed for most tests, but imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

/**
 * Creates a mock Drizzle-compatible DB object.
 * Mirrors the chained API: db.insert(t).values(d).returning()
 */
const createMockDb = () => {
  const returningFn = vi.fn()
  const onConflictDoUpdateFn = vi.fn(() => ({ returning: returningFn }))
  const valuesFn = vi.fn(() => ({
    returning: returningFn,
    onConflictDoUpdate: onConflictDoUpdateFn,
  }))
  const insertFn = vi.fn(() => ({ values: valuesFn }))

  const whereReturningFn = vi.fn()
  const whereFn = vi.fn(() => ({ returning: whereReturningFn }))
  const setFn = vi.fn(() => ({ where: whereFn }))
  const updateFn = vi.fn(() => ({ set: setFn }))

  const deleteWhereFn = vi.fn()
  const deleteWhereReturningFn = vi.fn()
  const deleteWhereMock = vi.fn(() => ({ returning: deleteWhereReturningFn }))
  const deleteFn = vi.fn(() => ({ where: deleteWhereMock }))

  const findFirst = vi.fn()
  const findMany = vi.fn()

  return {
    db: {
      insert: insertFn,
      update: updateFn,
      delete: deleteFn,
      query: {
        test_table: { findFirst, findMany },
      },
    } as any,
    // Expose inner mocks for assertion
    returningFn,
    valuesFn,
    setFn,
    whereFn,
    whereReturningFn,
    deleteWhereMock,
    deleteWhereReturningFn,
    findFirst,
    findMany,
    insertFn,
    onConflictDoUpdateFn,
  }
}

/**
 * Create a minimal table mock with column accessors for eq()
 */
const mockTable = {
  id: { name: `id` },
  orgId: { name: `org_id` },
  name: { name: `name` },
} as any

describe(`Base service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: Base<any>

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new Base({
      db: mocks.db,
      table: mockTable,
    })
  })

  // ---------- create ----------
  describe(`create`, () => {
    it(`should return model on success`, async () => {
      const record = { id: `1`, name: `Test` }
      mocks.returningFn.mockResolvedValue([record])

      const result = await service.create({ name: `Test` } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data).toEqual(record)
    })

    it(`should return error on db exception`, async () => {
      mocks.returningFn.mockRejectedValue(new Error(`DB failure`))

      const result = await service.create({ name: `Test` } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB failure`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- get ----------
  describe(`get`, () => {
    it(`should return model when found`, async () => {
      const record = { id: `abc`, name: `Found` }
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.get(`abc`)

      expect(result.data).toEqual(record)
      expect(result.error).toBeUndefined()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should return error when not found`, async () => {
      mocks.findFirst.mockResolvedValue(undefined)

      const result = await service.get(`missing-id`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain(`not found`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- by ----------
  describe(`by`, () => {
    it(`should query by object argument (CRIT-01)`, async () => {
      const record = { id: `1`, orgId: `abc` }
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.by({ orgId: `abc` })

      expect(result.data).toEqual(record)
      expect(result.error).toBeUndefined()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should query by string arguments`, async () => {
      const record = { id: `1`, orgId: `abc` }
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.by(`orgId`, `abc`)

      expect(result.data).toEqual(record)
      expect(result.error).toBeUndefined()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should return DBValueError when value is missing`, async () => {
      const result = await service.by(`orgId`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain(`value is required`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- list ----------
  describe(`list`, () => {
    it(`should return array of models`, async () => {
      const records = [
        { id: `1`, name: `A` },
        { id: `2`, name: `B` },
      ]
      mocks.findMany.mockResolvedValue(records)

      const result = await service.list()

      expect(result.data).toHaveLength(2)
      expect(result.data[0]).toEqual(records[0])
      expect(result.data[1]).toEqual(records[1])
    })

    it(`should return empty array when nothing found`, async () => {
      mocks.findMany.mockResolvedValue([])

      const result = await service.list()

      expect(result.data).toEqual([])
    })
  })

  // ---------- update ----------
  describe(`update`, () => {
    it(`should auto-set updatedAt (SV-02)`, async () => {
      const record = { id: `1`, name: `Updated` }
      mocks.whereReturningFn.mockResolvedValue([record])

      const before = Date.now()
      await service.update({ id: `1`, name: `Updated` } as any)
      const after = Date.now()

      // Verify set() was called with an updatedAt Date
      expect(mocks.setFn).toHaveBeenCalledOnce()
      const setArg = (mocks.setFn.mock.calls[0] as any)[0]
      expect(setArg.updatedAt).toBeInstanceOf(Date)
      expect(setArg.updatedAt.getTime()).toBeGreaterThanOrEqual(before)
      expect(setArg.updatedAt.getTime()).toBeLessThanOrEqual(after)
    })

    it(`should return error when record not found (SV-04)`, async () => {
      mocks.whereReturningFn.mockResolvedValue([])

      const result = await service.update({ id: `1`, name: `Ghost` } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Test_table not found`)
    })
  })

  // ---------- upsert ----------
  describe(`upsert`, () => {
    it(`should return error when result is empty`, async () => {
      mocks.returningFn.mockResolvedValue([])

      const result = await service.upsert({ id: `1`, name: `Upserted` } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Test_table not found`)
    })
  })

  // ---------- delete ----------
  describe(`delete`, () => {
    it(`should return error when record not found`, async () => {
      mocks.deleteWhereReturningFn.mockResolvedValue([])

      const result = await service.delete(`nonexistent`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Test_table not found`)
    })

    it(`should return model on successful delete`, async () => {
      const record = { id: `del-1`, name: `Deleted` }
      mocks.deleteWhereReturningFn.mockResolvedValue([record])

      const result = await service.delete(`del-1`)

      expect(result.data).toEqual(record)
      expect(result.error).toBeUndefined()
    })
  })

  // ---------- model (default) ----------
  describe(`model`, () => {
    it(`should log a warning when not overridden (SV-05)`, async () => {
      const { logger } = await import(`@TDB/utils/logger`)
      const data = { id: `1`, name: `Raw` } as any

      service.model(data)

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`should override this function`)
      )
    })
  })
})

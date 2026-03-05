import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Function as FunctionService } from './function'

// Mock the logger to avoid config/db initialization side-effects
vi.mock(`@TDB/utils/logger`, () => ({
  logger: { warn: vi.fn(), error: vi.fn(), info: vi.fn() },
}))

// Mock drizzle-orm utilities
vi.mock(`drizzle-orm`, async () => {
  const actual = await vi.importActual<typeof import('drizzle-orm')>(`drizzle-orm`)
  return {
    ...actual,
    inArray: vi.fn((col, vals) => ({ col, vals, _tag: `inArray` })),
    getTableName: vi.fn(() => `functions`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the functions schema
vi.mock(`@TDB/schemas/functions`, () => ({
  functions: {
    id: { name: `id` },
    name: { name: `name` },
    description: { name: `description` },
  },
}))

// Mock the domain model - FunctionModel is a data class, not JS Function constructor
vi.mock(`@tdsk/domain`, async () => {
  const orig = await vi.importActual(`@tdsk/domain`)
  return {
    ...orig,
    Function: vi.fn(function MockFunctionModel(data: any) {
      return { ...data, _isModel: true }
    }),
  }
})

/**
 * Creates a mock Drizzle-compatible DB object.
 * Mirrors the chained API: db.select().from(functions).where(cond)
 */
const createMockDb = () => {
  const selectWhereFn = vi.fn()
  const selectFromFn = vi.fn(() => ({ where: selectWhereFn }))
  const selectFn = vi.fn(() => ({ from: selectFromFn }))

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

  const deleteWhereReturningFn = vi.fn()
  const deleteWhereMock = vi.fn(() => ({ returning: deleteWhereReturningFn }))
  const deleteFn = vi.fn(() => ({ where: deleteWhereMock }))

  const findFirst = vi.fn()
  const findMany = vi.fn()

  return {
    db: {
      select: selectFn,
      insert: insertFn,
      update: updateFn,
      delete: deleteFn,
      query: {
        functions: { findFirst, findMany },
      },
    } as any,
    selectFn,
    selectFromFn,
    selectWhereFn,
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

describe(`Function service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: FunctionService

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks = createMockDb()

    const mod = await import(`./function`)
    service = new mod.Function({
      db: mocks.db,
      config: {} as any,
    })
  })

  describe(`getByIds`, () => {
    it(`should return empty data array without hitting DB when ids is empty`, async () => {
      const result = await service.getByIds([])

      expect(result.data).toEqual([])
      expect(result.error).toBeUndefined()
      expect(mocks.selectFn).not.toHaveBeenCalled()
    })

    it(`should return correctly mapped FunctionModel instances for valid ids`, async () => {
      const records = [
        { id: `fn-1`, name: `myFunc1`, description: `desc1` },
        { id: `fn-2`, name: `myFunc2`, description: `desc2` },
      ]
      mocks.selectWhereFn.mockResolvedValue(records)

      const result = await service.getByIds([`fn-1`, `fn-2`])

      expect(result.data).toHaveLength(2)
      expect(result.data![0]._isModel).toBe(true)
      expect(result.data![0].id).toBe(`fn-1`)
      expect(result.data![1]._isModel).toBe(true)
      expect(result.data![1].id).toBe(`fn-2`)
      expect(result.error).toBeUndefined()
    })

    it(`should call inArray with function ids`, async () => {
      mocks.selectWhereFn.mockResolvedValue([])

      await service.getByIds([`fn-a`, `fn-b`])

      const { inArray } = await import(`drizzle-orm`)
      const { functions } = await import(`@TDB/schemas/functions`)
      expect(inArray).toHaveBeenCalledWith(functions.id, [`fn-a`, `fn-b`])
    })

    it(`should return error without throwing on DB exception`, async () => {
      const dbError = new Error(`Connection refused`)
      mocks.selectWhereFn.mockRejectedValue(dbError)

      const result = await service.getByIds([`fn-1`])

      expect(result.error).toBeDefined()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error!.message).toBe(`Connection refused`)
      expect(result.data).toBeUndefined()
    })

    it(`should normalize non-Error thrown values to Error`, async () => {
      mocks.selectWhereFn.mockRejectedValue(`string error`)

      const result = await service.getByIds([`fn-1`])

      expect(result.error).toBeInstanceOf(Error)
      expect(result.error!.message).toBe(`string error`)
    })

    it(`should call db.select().from(functions).where() chain`, async () => {
      const { functions } = await import(`@TDB/schemas/functions`)
      mocks.selectWhereFn.mockResolvedValue([])

      await service.getByIds([`fn-1`])

      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(mocks.selectFromFn).toHaveBeenCalledWith(functions)
      expect(mocks.selectWhereFn).toHaveBeenCalledOnce()
    })
  })
})

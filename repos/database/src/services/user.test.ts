import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { User as UserService } from './user'

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
    and: vi.fn((...args) => args),
    getTableName: vi.fn(() => `users`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the users schema
vi.mock(`@TDB/schemas/users`, () => ({
  users: {
    id: { name: `id` },
    email: { name: `email` },
    firstName: { name: `first_name` },
    lastName: { name: `last_name` },
  },
}))

// Mock the User domain model
vi.mock(`@tdsk/domain`, async () => {
  const orig = await vi.importActual(`@tdsk/domain`)
  return {
    ...orig,
    User: vi.fn(function MockUser(data: any) {
      return { ...data, _isModel: true }
    }),
  }
})

/**
 * Creates a mock Drizzle-compatible DB object.
 * Mirrors the chained API: db.select().from(users).where(cond).limit(1)
 */
const createMockDb = () => {
  const limitFn = vi.fn()
  const selectWhereFn = vi.fn(() => ({ limit: limitFn }))
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
        users: { findFirst, findMany },
      },
    } as any,
    selectFn,
    selectFromFn,
    selectWhereFn,
    limitFn,
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

describe(`User service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: UserService

  beforeEach(async () => {
    vi.clearAllMocks()
    mocks = createMockDb()

    const { User } = await import(`./user`)
    service = new User({
      db: mocks.db,
      config: {} as any,
    })
  })

  // ---------- constructor ----------
  describe(`constructor`, () => {
    it(`should instantiate correctly with users table`, () => {
      expect(service).toBeDefined()
      expect(service).toBeInstanceOf(Object)
    })

    it(`should have the users table set via super`, async () => {
      const { users } = await import(`@TDB/schemas/users`)
      // The Base constructor stores opts.table; verify the service references the users schema
      expect((service as any).table).toBe(users)
    })
  })

  // ---------- model ----------
  describe(`model`, () => {
    it(`should create a UserModel from data`, () => {
      const data = {
        id: `user-1`,
        email: `test@example.com`,
        firstName: `Test`,
        lastName: `User`,
      }

      const result = service.model(data as any)

      expect(result).toBeDefined()
      expect((result as any)._isModel).toBe(true)
      expect(result.id).toBe(`user-1`)
      expect(result.email).toBe(`test@example.com`)
    })

    it(`should call the User domain constructor with the data`, async () => {
      const { User: UserModel } = await import(`@tdsk/domain`)
      const data = { id: `user-2`, email: `foo@bar.com` }

      service.model(data as any)

      expect(UserModel).toHaveBeenCalledWith(data)
    })

    it(`should return the constructed model instance`, () => {
      const data = { id: `user-3`, email: `baz@qux.com`, first: `Baz` }

      const result = service.model(data as any)
      expect(result._isModel).toBe(true)
      expect(result.first).toBe(`Baz`)
    })
  })

  // ---------- byEmail ----------
  describe(`byEmail`, () => {
    it(`should return model when user is found`, async () => {
      const record = { id: `user-1`, email: `found@example.com`, firstName: `Found` }
      mocks.limitFn.mockResolvedValue([record])

      const result = await service.byEmail(`found@example.com`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.email).toBe(`found@example.com`)
      expect(result.error).toBeUndefined()
    })

    it(`should return error 'User not found' when no result`, async () => {
      mocks.limitFn.mockResolvedValue([])

      const result = await service.byEmail(`missing@example.com`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`User not found`)
      expect(result.data).toBeUndefined()
    })

    it(`should return error 'User not found' when result[0] is undefined`, async () => {
      mocks.limitFn.mockResolvedValue([undefined])

      const result = await service.byEmail(`ghost@example.com`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`User not found`)
      expect(result.data).toBeUndefined()
    })

    it(`should return error on db exception`, async () => {
      const dbError = new Error(`Connection refused`)
      mocks.limitFn.mockRejectedValue(dbError)

      const result = await service.byEmail(`error@example.com`)

      expect(result.error).toBeDefined()
      expect(result.error).toBe(dbError)
      expect(result.error.message).toBe(`Connection refused`)
      expect(result.data).toBeUndefined()
    })

    it(`should call eq with users.email and the email value`, async () => {
      const { eq } = await import(`drizzle-orm`)
      const { users } = await import(`@TDB/schemas/users`)
      mocks.limitFn.mockResolvedValue([{ id: `user-1`, email: `check@eq.com` }])

      await service.byEmail(`check@eq.com`)

      expect(eq).toHaveBeenCalledWith(users.email, `check@eq.com`)
    })

    it(`should pass eq result directly to where()`, async () => {
      const { eq } = await import(`drizzle-orm`)
      mocks.limitFn.mockResolvedValue([{ id: `user-1`, email: `check@and.com` }])

      await service.byEmail(`check@and.com`)

      expect(eq).toHaveBeenCalledWith(expect.anything(), `check@and.com`)
      expect(mocks.selectWhereFn).toHaveBeenCalledWith(
        expect.objectContaining({ _tag: `eq`, val: `check@and.com` })
      )
    })

    it(`should call .limit(1)`, async () => {
      mocks.limitFn.mockResolvedValue([])

      await service.byEmail(`limit@test.com`)

      expect(mocks.selectWhereFn).toHaveBeenCalledOnce()
      expect(mocks.limitFn).toHaveBeenCalledWith(1)
    })

    it(`should call db.select().from(users).where().limit() chain`, async () => {
      const { users } = await import(`@TDB/schemas/users`)
      mocks.limitFn.mockResolvedValue([])

      await service.byEmail(`chain@test.com`)

      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(mocks.selectFromFn).toHaveBeenCalledWith(users)
      expect(mocks.selectWhereFn).toHaveBeenCalledOnce()
      expect(mocks.limitFn).toHaveBeenCalledWith(1)
    })

    it(`should wrap the found record in a model via this.model()`, async () => {
      const record = { id: `user-wrap`, email: `wrap@model.com`, first: `Wrap` }
      mocks.limitFn.mockResolvedValue([record])

      const result = await service.byEmail(`wrap@model.com`)

      expect(result.data._isModel).toBe(true)
      expect(result.data.id).toBe(`user-wrap`)
      expect(result.data.first).toBe(`Wrap`)
    })
  })

  // ---------- inherited Base methods ----------
  describe(`inherited Base methods`, () => {
    it(`should support get() from Base`, async () => {
      const record = { id: `user-get`, email: `get@test.com` }
      mocks.findFirst.mockResolvedValue(record)

      const result = await service.get(`user-get`)

      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
      expect(result.error).toBeUndefined()
      expect(mocks.findFirst).toHaveBeenCalledOnce()
    })

    it(`should support list() from Base`, async () => {
      const records = [
        { id: `u1`, email: `a@test.com` },
        { id: `u2`, email: `b@test.com` },
      ]
      mocks.findMany.mockResolvedValue(records)

      const result = await service.list()

      expect(result.data).toHaveLength(2)
      expect(result.data[0]._isModel).toBe(true)
      expect(result.data[1]._isModel).toBe(true)
    })

    it(`should support create() from Base`, async () => {
      const record = { id: `user-new`, email: `new@test.com` }
      mocks.returningFn.mockResolvedValue([record])

      const result = await service.create({ email: `new@test.com` } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
    })
  })
})

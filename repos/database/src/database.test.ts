import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Pool } from 'pg'

/**
 * Mock pg Pool — capture the constructor args and provide a mock `end` method
 */
const mockPoolEnd = vi.fn().mockResolvedValue(undefined)
vi.mock(`pg`, () => ({
  Pool: vi.fn(() => ({
    end: mockPoolEnd,
  })),
}))

/**
 * Mock drizzle — returns a plain object (the "database instance")
 * Services will be attached to it at runtime
 */
const mockDrizzle = vi.fn(() => ({}))
vi.mock(`drizzle-orm/node-postgres`, () => ({
  drizzle: mockDrizzle,
}))

/**
 * Mock the config module so it does not try to load env files
 */
vi.mock(`@TDB/configs/db.config`, () => ({
  config: { url: `postgresql://test:test@localhost:5432/testdb` },
}))

/**
 * Mock schemas — just provide the `users` and `orgs` keys
 * that database.ts destructures, plus a representative "rest" key
 */
vi.mock(`@TDB/schemas`, () => ({
  users: { name: `users` },
  orgs: { name: `orgs` },
  projects: { name: `projects` },
}))

/**
 * Mock all services — each export must be a class-like constructor
 * The database factory iterates `Object.entries(DBservices)` and calls `new Service(…)`
 */
vi.mock(`@TDB/services`, () => {
  const makeService = () =>
    vi.fn(function MockService() {
      return {}
    })
  return {
    org: makeService(),
    user: makeService(),
    role: makeService(),
    asset: makeService(),
    quota: makeService(),
    agent: makeService(),
    apiKey: makeService(),
    secret: makeService(),
    config: makeService(),
    thread: makeService(),
    project: makeService(),
    message: makeService(),
    endpoint: makeService(),
    function: makeService(),
    provider: makeService(),
    domain: makeService(),
    invitation: makeService(),
    subscription: makeService(),
  }
})

describe(`database factory`, () => {
  beforeEach(() => {
    vi.resetModules()
    mockPoolEnd.mockClear()
    mockDrizzle.mockClear()
    ;(Pool as unknown as ReturnType<typeof vi.fn>).mockClear()
  })

  it(`returns a database instance`, async () => {
    const { database } = await import(`./database`)
    const db = database()
    expect(db).toBeDefined()
    expect(db).toBeTypeOf(`object`)
  })

  it(`returns the same singleton on repeated calls`, async () => {
    const { database } = await import(`./database`)
    const db1 = database()
    const db2 = database()
    expect(db1).toBe(db2)
  })

  it(`initializes services on the database instance`, async () => {
    const { database } = await import(`./database`)
    const db = database()
    expect(db.services).toBeDefined()
    expect(db.services).toBeTypeOf(`object`)
    expect(Object.keys(db.services).length).toBeGreaterThan(0)
  })

  it(`creates all expected service keys`, async () => {
    const { database } = await import(`./database`)
    const db = database()
    const expectedServices = [
      `org`,
      `user`,
      `role`,
      `asset`,
      `quota`,
      `agent`,
      `apiKey`,
      `secret`,
      `config`,
      `thread`,
      `project`,
      `message`,
      `endpoint`,
      `function`,
      `provider`,
      `domain`,
      `invitation`,
      `subscription`,
    ]
    for (const svc of expectedServices) {
      expect(db.services).toHaveProperty(svc)
    }
  })

  it(`creates a Pool with the default config URL`, async () => {
    const { database } = await import(`./database`)
    database()
    expect(Pool).toHaveBeenCalledWith({
      connectionString: `postgresql://test:test@localhost:5432/testdb`,
    })
  })

  it(`passes a custom config URL to the Pool when provided`, async () => {
    const { database } = await import(`./database`)
    const customConfig = { url: `postgresql://custom:pass@remote:5432/prod` }
    database(customConfig as any)
    expect(Pool).toHaveBeenCalledWith({
      connectionString: `postgresql://custom:pass@remote:5432/prod`,
    })
  })

  it(`calls drizzle with the pool client and remapped schema`, async () => {
    const { database } = await import(`./database`)
    database()
    expect(mockDrizzle).toHaveBeenCalledTimes(1)
    const callArgs = (mockDrizzle.mock.calls[0] as any)[0] as any
    expect(callArgs).toHaveProperty(`client`)
    expect(callArgs).toHaveProperty(`schema`)
    // users -> user, orgs -> organizations
    expect(callArgs.schema).toHaveProperty(`user`)
    expect(callArgs.schema).toHaveProperty(`organizations`)
    // original keys should not be present under their schema export names
    expect(callArgs.schema).not.toHaveProperty(`users`)
    expect(callArgs.schema).not.toHaveProperty(`orgs`)
    // rest of schema passes through
    expect(callArgs.schema).toHaveProperty(`projects`)
  })

  it(`only creates the Pool once for the singleton`, async () => {
    const { database } = await import(`./database`)
    database()
    database()
    database()
    expect(Pool).toHaveBeenCalledTimes(1)
  })

  describe(`disconnectDatabase`, () => {
    it(`closes the pool on disconnect`, async () => {
      const { database, disconnectDatabase } = await import(`./database`)
      database()
      await disconnectDatabase()
      expect(mockPoolEnd).toHaveBeenCalledTimes(1)
    })

    it(`allows creating a new instance after disconnect`, async () => {
      const { database, disconnectDatabase } = await import(`./database`)
      const db1 = database()
      await disconnectDatabase()
      const db2 = database()
      expect(db2).toBeDefined()
      expect(db2).not.toBe(db1)
    })

    it(`creates a new Pool after disconnect and re-init`, async () => {
      const { database, disconnectDatabase } = await import(`./database`)
      database()
      expect(Pool).toHaveBeenCalledTimes(1)
      await disconnectDatabase()
      database()
      expect(Pool).toHaveBeenCalledTimes(2)
    })

    it(`is safe to call disconnect when no database exists`, async () => {
      const { disconnectDatabase } = await import(`./database`)
      await expect(disconnectDatabase()).resolves.toBeUndefined()
      expect(mockPoolEnd).not.toHaveBeenCalled()
    })

    it(`is safe to call disconnect multiple times`, async () => {
      const { database, disconnectDatabase } = await import(`./database`)
      database()
      await disconnectDatabase()
      await disconnectDatabase()
      expect(mockPoolEnd).toHaveBeenCalledTimes(1)
    })
  })
})

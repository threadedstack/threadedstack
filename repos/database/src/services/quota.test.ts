import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Quota } from './quota'

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
    sql: vi.fn((...args) => args),
    getTableName: vi.fn(() => `quotas`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the domain Quota model — must preserve EFunLanguage / EInviteStatus
// because the schema tree (quotas→orgs→functions/invitations) loads them at import time
vi.mock(`@tdsk/domain`, async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tdsk/domain')>()
  return {
    ...actual,
    Quota: vi.fn(function MockQuota(data: any) {
      return { ...data, _isModel: true }
    }),
  }
})

/**
 * Create a minimal table mock with column accessors for eq() / sql references.
 * Mirrors the shape of the `quotas` pgTable schema.
 */
const mockTable = {
  id: { name: `id` },
  orgId: { name: `org_id` },
  period: { name: `period` },
  price: { name: `price` },
  retention: { name: `retention` },
  members: { name: `members` },
  threads: { name: `threads` },
  runtime: { name: `runtime` },
  messages: { name: `messages` },
  projects: { name: `projects` },
  endpoints: { name: `endpoints` },
  orgSecrets: { name: `org_secrets` },
  organizations: { name: `organizations` },
  functionCalls: { name: `function_calls` },
  projectSecrets: { name: `project_secrets` },
} as any

/**
 * Creates a mock Drizzle-compatible DB object.
 * Covers the three chain patterns used by the Quota service:
 *   select → from → where                          (getUsage)
 *   insert → values → onConflictDoUpdate → returning (increment)
 *   insert → values → onConflictDoNothing → returning (initializePeriod)
 */
const createMockDb = () => {
  // select chain: db.select().from(table).where(...)
  const selectWhereFn = vi.fn()
  const selectFromFn = vi.fn(() => ({ where: selectWhereFn }))
  const selectFn = vi.fn(() => ({ from: selectFromFn }))

  // insert chain: db.insert(table).values(data).onConflictDoUpdate(opts).returning()
  //                                             .onConflictDoNothing().returning()
  //                                             .returning()
  const returningFn = vi.fn()
  const onConflictDoUpdateFn = vi.fn(() => ({ returning: returningFn }))
  const onConflictDoNothingFn = vi.fn(() => ({ returning: returningFn }))
  const valuesFn = vi.fn(() => ({
    returning: returningFn,
    onConflictDoUpdate: onConflictDoUpdateFn,
    onConflictDoNothing: onConflictDoNothingFn,
  }))
  const insertFn = vi.fn(() => ({ values: valuesFn }))

  // query chain (used by inherited Base methods — e.g. get/by/list)
  const findFirst = vi.fn()
  const findMany = vi.fn()

  return {
    db: {
      select: selectFn,
      insert: insertFn,
      query: {
        quotas: { findFirst, findMany },
      },
    } as any,
    // Expose inner mocks for assertion
    selectFn,
    selectFromFn,
    selectWhereFn,
    insertFn,
    valuesFn,
    returningFn,
    onConflictDoUpdateFn,
    onConflictDoNothingFn,
    findFirst,
    findMany,
  }
}

/**
 * Builds a fake quota row that looks like what the DB would return.
 */
const fakeQuotaRow = (overrides: Record<string, any> = {}) => ({
  id: `quota-1`,
  orgId: `org-1`,
  period: `2025-01`,
  price: 0,
  retention: 30,
  members: 0,
  threads: 0,
  runtime: 0,
  messages: 0,
  projects: 0,
  endpoints: 0,
  orgSecrets: 0,
  organizations: 0,
  functionCalls: 0,
  projectSecrets: 0,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`Quota service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: Quota

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new Quota({
      db: mocks.db,
      table: mockTable,
    } as any)
  })

  // ---------- constructor ----------
  describe(`constructor`, () => {
    it(`should instantiate with the quotas table`, () => {
      expect(service).toBeInstanceOf(Quota)
      expect(service.name).toBe(`quotas`)
    })
  })

  // ---------- model ----------
  describe(`model`, () => {
    it(`should create a QuotaModel from data`, () => {
      const row = fakeQuotaRow()
      const result = service.model(row as any)

      expect(result).toBeDefined()
      expect(result._isModel).toBe(true)
      expect(result.orgId).toBe(`org-1`)
    })
  })

  // ---------- getUsage ----------
  describe(`getUsage`, () => {
    it(`should return a model when the quota is found`, async () => {
      const row = fakeQuotaRow()
      mocks.selectWhereFn.mockResolvedValue([row])

      const result = await service.getUsage(`org-1`, `2025-01`)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.orgId).toBe(`org-1`)

      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(mocks.selectFromFn).toHaveBeenCalledOnce()
      expect(mocks.selectWhereFn).toHaveBeenCalledOnce()
    })

    it(`should return error when quota is not found`, async () => {
      mocks.selectWhereFn.mockResolvedValue([])

      const result = await service.getUsage(`org-missing`, `2025-01`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Quota not found`)
      expect(result.data).toBeUndefined()
    })

    it(`should return error when the result is undefined`, async () => {
      mocks.selectWhereFn.mockResolvedValue([undefined])

      const result = await service.getUsage(`org-1`, `2025-01`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Quota not found`)
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`DB connection failed`))

      const result = await service.getUsage(`org-1`, `2025-01`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB connection failed`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- findByOrgAndPeriod ----------
  describe(`findByOrgAndPeriod`, () => {
    it(`should delegate to getUsage`, async () => {
      const row = fakeQuotaRow()
      mocks.selectWhereFn.mockResolvedValue([row])

      const spy = vi.spyOn(service, `getUsage`)
      const result = await service.findByOrgAndPeriod(`org-1`, `2025-01`)

      expect(spy).toHaveBeenCalledWith(`org-1`, `2025-01`)
      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
    })

    it(`should return error when getUsage returns error`, async () => {
      mocks.selectWhereFn.mockResolvedValue([])

      const result = await service.findByOrgAndPeriod(`org-missing`, `2025-01`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Quota not found`)
    })
  })

  // ---------- increment (CRIT-07 / SEC-01) ----------
  describe(`increment`, () => {
    describe(`negative / zero amount guard (CRIT-07)`, () => {
      it(`should reject amount = 0 with positive-amount error`, async () => {
        const result = await service.increment(`org-1`, `2025-01`, `members`, 0)

        expect(result.error).toBeDefined()
        expect(result.error.message).toContain(`must be positive`)
        expect(result.data).toBeUndefined()
        // DB should never be called
        expect(mocks.insertFn).not.toHaveBeenCalled()
      })

      it(`should reject amount = -1 with positive-amount error`, async () => {
        const result = await service.increment(`org-1`, `2025-01`, `threads`, -1)

        expect(result.error).toBeDefined()
        expect(result.error.message).toContain(`must be positive`)
        expect(result.data).toBeUndefined()
        expect(mocks.insertFn).not.toHaveBeenCalled()
      })

      it(`should reject amount = -100 with positive-amount error`, async () => {
        const result = await service.increment(`org-1`, `2025-01`, `runtime`, -100)

        expect(result.error).toBeDefined()
        expect(result.error.message).toContain(`must be positive`)
        expect(result.data).toBeUndefined()
        expect(mocks.insertFn).not.toHaveBeenCalled()
      })

      it(`should reject negative fractional amount`, async () => {
        const result = await service.increment(`org-1`, `2025-01`, `messages`, -0.5)

        expect(result.error).toBeDefined()
        expect(result.error.message).toContain(`must be positive`)
        expect(result.data).toBeUndefined()
        expect(mocks.insertFn).not.toHaveBeenCalled()
      })
    })

    it(`should succeed with amount = 1 (default)`, async () => {
      const row = fakeQuotaRow({ members: 1 })
      mocks.returningFn.mockResolvedValue([row])

      const result = await service.increment(`org-1`, `2025-01`, `members`, 1)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.members).toBe(1)

      expect(mocks.insertFn).toHaveBeenCalledOnce()
      expect(mocks.valuesFn).toHaveBeenCalledOnce()
      expect(mocks.onConflictDoUpdateFn).toHaveBeenCalledOnce()
      expect(mocks.returningFn).toHaveBeenCalledOnce()
    })

    it(`should succeed with a large positive amount`, async () => {
      const row = fakeQuotaRow({ functionCalls: 500 })
      mocks.returningFn.mockResolvedValue([row])

      const result = await service.increment(`org-1`, `2025-01`, `functionCalls`, 500)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data.functionCalls).toBe(500)
    })

    it(`should return error for an invalid quota key`, async () => {
      const result = await service.increment(
        `org-1`,
        `2025-01`,
        `nonExistentKey` as any,
        1
      )

      expect(result.error).toBeDefined()
      expect(result.error.message).toContain(`Invalid quota key`)
      expect(mocks.insertFn).not.toHaveBeenCalled()
    })

    it(`should return error on DB exception`, async () => {
      mocks.returningFn.mockRejectedValue(new Error(`Insert conflict`))

      const result = await service.increment(`org-1`, `2025-01`, `projects`, 1)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Insert conflict`)
      expect(result.data).toBeUndefined()
    })

    it(`should pass correct values to the insert chain`, async () => {
      const row = fakeQuotaRow({ endpoints: 3 })
      mocks.returningFn.mockResolvedValue([row])

      await service.increment(`org-1`, `2025-01`, `endpoints`, 3)

      // Verify values() received the right partial insert
      const valuesArg = (mocks.valuesFn.mock.calls[0] as any)[0]
      expect(valuesArg.orgId).toBe(`org-1`)
      expect(valuesArg.period).toBe(`2025-01`)
      expect(valuesArg.endpoints).toBe(3)
    })
  })

  // ---------- initializePeriod ----------
  describe(`initializePeriod`, () => {
    it(`should return model when insert succeeds (no conflict)`, async () => {
      const row = fakeQuotaRow({ price: 999, retention: 90 })
      mocks.returningFn.mockResolvedValue([row])

      const result = await service.initializePeriod(`org-1`, `2025-01`, 999, 90)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.price).toBe(999)
      expect(result.data.retention).toBe(90)

      expect(mocks.insertFn).toHaveBeenCalledOnce()
      expect(mocks.valuesFn).toHaveBeenCalledOnce()
      expect(mocks.onConflictDoNothingFn).toHaveBeenCalledOnce()
      expect(mocks.returningFn).toHaveBeenCalledOnce()
    })

    it(`should insert all counters at zero`, async () => {
      const row = fakeQuotaRow()
      mocks.returningFn.mockResolvedValue([row])

      await service.initializePeriod(`org-1`, `2025-01`, 0, 30)

      const valuesArg = (mocks.valuesFn.mock.calls[0] as any)[0]
      expect(valuesArg.orgId).toBe(`org-1`)
      expect(valuesArg.period).toBe(`2025-01`)
      expect(valuesArg.price).toBe(0)
      expect(valuesArg.retention).toBe(30)
      expect(valuesArg.members).toBe(0)
      expect(valuesArg.threads).toBe(0)
      expect(valuesArg.runtime).toBe(0)
      expect(valuesArg.messages).toBe(0)
      expect(valuesArg.projects).toBe(0)
      expect(valuesArg.endpoints).toBe(0)
      expect(valuesArg.orgSecrets).toBe(0)
      expect(valuesArg.organizations).toBe(0)
      expect(valuesArg.functionCalls).toBe(0)
      expect(valuesArg.projectSecrets).toBe(0)
    })

    it(`should fall back to getUsage when conflict occurs (data is undefined)`, async () => {
      // First call (returning from onConflictDoNothing) returns empty → conflict path
      mocks.returningFn.mockResolvedValue([undefined])
      // getUsage will call select chain
      const existingRow = fakeQuotaRow()
      mocks.selectWhereFn.mockResolvedValue([existingRow])

      const result = await service.initializePeriod(`org-1`, `2025-01`, 0, 30)

      // Should have fallen through to getUsage
      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(result.data).toBeDefined()
      expect(result.data._isModel).toBe(true)
    })

    it(`should fall back to getUsage when returning resolves with empty array`, async () => {
      // returning() resolves to [] — destructured [data] = undefined
      mocks.returningFn.mockResolvedValue([])
      const existingRow = fakeQuotaRow()
      mocks.selectWhereFn.mockResolvedValue([existingRow])

      const result = await service.initializePeriod(`org-1`, `2025-01`, 0, 30)

      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(result.data).toBeDefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.returningFn.mockRejectedValue(new Error(`Connection lost`))

      const result = await service.initializePeriod(`org-1`, `2025-01`, 0, 30)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Connection lost`)
      expect(result.data).toBeUndefined()
    })
  })
})

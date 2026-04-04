import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Invoice } from './invoice'

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
    getTableName: vi.fn(() => `invoices`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the invoices schema table
vi.mock(`@TDB/schemas/invoices`, () => ({
  invoices: {
    id: { name: `id` },
    userId: { name: `user_id` },
    stripeInvoiceId: { name: `stripe_invoice_id` },
    amount: { name: `amount` },
    currency: { name: `currency` },
    status: { name: `status` },
    invoiceUrl: { name: `invoice_url` },
    period: { name: `period` },
    createdAt: { name: `created_at` },
  },
}))

// Mock the domain Invoice model
vi.mock(`@tdsk/domain`, async () => {
  const orig = await vi.importActual(`@tdsk/domain`)
  return {
    ...orig,
    Invoice: vi.fn(function MockInvoice(data: any) {
      return { ...data, _isModel: true }
    }),
  }
})

/**
 * Creates a mock Drizzle-compatible DB object.
 * Covers the chain patterns used by the Invoice service:
 *   select -> from -> where -> orderBy                   (findByUserId)
 *   insert -> values -> onConflictDoUpdate -> returning   (upsertByStripeId)
 */
const createMockDb = () => {
  // select chain: db.select().from(table).where(...).orderBy(...)
  const selectOrderByFn = vi.fn()
  const selectWhereFn = vi.fn(() => ({ orderBy: selectOrderByFn }))
  const selectFromFn = vi.fn(() => ({ where: selectWhereFn }))
  const selectFn = vi.fn(() => ({ from: selectFromFn }))

  // insert chain: db.insert(table).values(data).onConflictDoUpdate(opts).returning()
  const returningFn = vi.fn()
  const onConflictDoUpdateFn = vi.fn(() => ({ returning: returningFn }))
  const valuesFn = vi.fn(() => ({
    returning: returningFn,
    onConflictDoUpdate: onConflictDoUpdateFn,
  }))
  const insertFn = vi.fn(() => ({ values: valuesFn }))

  // query chain (used by inherited Base methods)
  const findFirst = vi.fn()
  const findMany = vi.fn()

  return {
    db: {
      select: selectFn,
      insert: insertFn,
      query: {
        invoices: { findFirst, findMany },
      },
    } as any,
    selectFn,
    selectFromFn,
    selectWhereFn,
    selectOrderByFn,
    insertFn,
    valuesFn,
    returningFn,
    onConflictDoUpdateFn,
    findFirst,
    findMany,
  }
}

/**
 * Builds a fake invoice row that looks like what the DB would return.
 */
const fakeInvoiceRow = (overrides: Record<string, any> = {}) => ({
  id: `inv-1`,
  userId: `user-1`,
  stripeInvoiceId: `in_test1`,
  amount: 2000,
  currency: `usd`,
  status: `paid`,
  invoiceUrl: `https://stripe.com/invoice/in_test1`,
  period: `2025-01`,
  createdAt: new Date(`2025-01-15`),
  updatedAt: new Date(`2025-01-15`),
  ...overrides,
})

describe(`Invoice service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: Invoice

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new Invoice({ db: mocks.db } as any)
  })

  // ---------- constructor ----------
  describe(`constructor`, () => {
    it(`should instantiate with the invoices table`, () => {
      expect(service).toBeInstanceOf(Invoice)
      expect(service.name).toBe(`invoices`)
    })
  })

  // ---------- model ----------
  describe(`model`, () => {
    it(`should create an InvoiceModel from data`, () => {
      const row = fakeInvoiceRow()
      const result = service.model(row as any)

      expect(result).toBeDefined()
      expect(result._isModel).toBe(true)
      expect(result.userId).toBe(`user-1`)
      expect(result.stripeInvoiceId).toBe(`in_test1`)
      expect(result.amount).toBe(2000)
    })
  })

  // ---------- findByUserId ----------
  describe(`findByUserId`, () => {
    it(`should return array of models ordered by createdAt`, async () => {
      const row1 = fakeInvoiceRow({ id: `inv-1`, createdAt: new Date(`2025-01-01`) })
      const row2 = fakeInvoiceRow({ id: `inv-2`, createdAt: new Date(`2025-02-01`) })
      mocks.selectOrderByFn.mockResolvedValue([row1, row2])

      const result = await service.findByUserId(`user-1`)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data).toHaveLength(2)
      expect(result.data![0]._isModel).toBe(true)
      expect(result.data![1]._isModel).toBe(true)

      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(mocks.selectFromFn).toHaveBeenCalledOnce()
      expect(mocks.selectWhereFn).toHaveBeenCalledOnce()
      expect(mocks.selectOrderByFn).toHaveBeenCalledOnce()
    })

    it(`should pass the correct eq condition for userId`, async () => {
      const { eq } = await import(`drizzle-orm`)
      mocks.selectOrderByFn.mockResolvedValue([])

      await service.findByUserId(`user-42`)

      expect(eq).toHaveBeenCalledWith(
        expect.objectContaining({ name: `user_id` }),
        `user-42`
      )
    })

    it(`should return empty array for unknown user`, async () => {
      mocks.selectOrderByFn.mockResolvedValue([])

      const result = await service.findByUserId(`user-missing`)

      expect(result.data).toBeDefined()
      expect(result.data).toHaveLength(0)
      expect(result.error).toBeUndefined()
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectOrderByFn.mockRejectedValue(new Error(`DB connection failed`))

      const result = await service.findByUserId(`user-1`)

      expect(result.error).toBeDefined()
      expect(result.error!.message).toBe(`DB connection failed`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- upsertByStripeId ----------
  describe(`upsertByStripeId`, () => {
    it(`should insert new invoice`, async () => {
      const row = fakeInvoiceRow()
      mocks.returningFn.mockResolvedValue([row])

      const result = await service.upsertByStripeId(`in_test1`, {
        userId: `user-1`,
        amount: 2000,
        currency: `usd`,
        status: `paid`,
        period: `2025-01`,
      })

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data!._isModel).toBe(true)
      expect(result.data!.stripeInvoiceId).toBe(`in_test1`)

      expect(mocks.insertFn).toHaveBeenCalledOnce()
      expect(mocks.valuesFn).toHaveBeenCalledOnce()
      expect(mocks.onConflictDoUpdateFn).toHaveBeenCalledOnce()
      expect(mocks.returningFn).toHaveBeenCalledOnce()
    })

    it(`should update existing invoice on conflict`, async () => {
      const updatedRow = fakeInvoiceRow({ status: `paid`, amount: 5000 })
      mocks.returningFn.mockResolvedValue([updatedRow])

      const result = await service.upsertByStripeId(`in_test1`, {
        amount: 5000,
        status: `paid`,
      })

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data!.amount).toBe(5000)

      // Verify onConflictDoUpdate was called with the correct target
      expect(mocks.onConflictDoUpdateFn).toHaveBeenCalledOnce()
      const conflictArg = (mocks.onConflictDoUpdateFn.mock.calls[0] as any)[0]
      expect(conflictArg.target).toBeDefined()
    })

    it(`should pass stripeInvoiceId in the values`, async () => {
      const row = fakeInvoiceRow()
      mocks.returningFn.mockResolvedValue([row])

      await service.upsertByStripeId(`in_new_123`, {
        userId: `user-1`,
        amount: 1000,
        status: `draft`,
        period: `2025-03`,
      })

      const valuesArg = (mocks.valuesFn.mock.calls[0] as any)[0]
      expect(valuesArg.stripeInvoiceId).toBe(`in_new_123`)
      expect(valuesArg.userId).toBe(`user-1`)
      expect(valuesArg.amount).toBe(1000)
    })

    it(`should return error on DB exception`, async () => {
      mocks.returningFn.mockRejectedValue(new Error(`Insert conflict`))

      const result = await service.upsertByStripeId(`in_test1`, {
        userId: `user-1`,
        amount: 2000,
        status: `paid`,
        period: `2025-01`,
      })

      expect(result.error).toBeDefined()
      expect(result.error!.message).toBe(`Insert conflict`)
      expect(result.data).toBeUndefined()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { Subscription } from './subscription'

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
    getTableName: vi.fn(() => `subscriptions`),
  }
})

// Mock buildQuery helpers (imported by base)
vi.mock(`@TDB/utils/database/buildQuery`, () => ({
  addWhere: vi.fn(() => []),
  addOrderBy: vi.fn(() => []),
}))

// Mock the subscriptions schema table
vi.mock(`@TDB/schemas/subscriptions`, () => ({
  subscriptions: {
    id: { name: `id` },
    userId: { name: `user_id` },
    stripeCustomerId: { name: `stripe_customer_id` },
    stripeSubscriptionId: { name: `stripe_subscription_id` },
    stripePriceId: { name: `stripe_price_id` },
    tier: { name: `tier` },
    status: { name: `status` },
    seats: { name: `seats` },
  },
}))

// Mock the domain Subscription model
vi.mock(`@tdsk/domain`, async () => {
  const orig = await vi.importActual(`@tdsk/domain`)
  return {
    ...orig,
    Subscription: vi.fn(function MockSubscription(data: any) {
      return { ...data, _isModel: true }
    }),
  }
})

/**
 * Creates a mock Drizzle-compatible DB object.
 * Covers the chain pattern used by the Subscription service:
 *   select -> from -> where    (findByUser, findByStripeSubscriptionId, findByStripeCustomerId)
 */
const createMockDb = () => {
  const selectWhereFn = vi.fn()
  const selectFromFn = vi.fn(() => ({ where: selectWhereFn }))
  const selectFn = vi.fn(() => ({ from: selectFromFn }))

  const findFirst = vi.fn()
  const findMany = vi.fn()

  // Insert chain: db.insert(t).values(d).returning()
  const insertReturningFn = vi.fn()
  const insertValuesFn = vi.fn(() => ({ returning: insertReturningFn }))
  const insertFn = vi.fn(() => ({ values: insertValuesFn }))

  // Update chain: db.update(t).set(d).where(w).returning()
  const updateReturningFn = vi.fn()
  const updateWhereFn = vi.fn(() => ({ returning: updateReturningFn }))
  const updateSetFn = vi.fn(() => ({ where: updateWhereFn }))
  const updateFn = vi.fn(() => ({ set: updateSetFn }))

  return {
    db: {
      select: selectFn,
      insert: insertFn,
      update: updateFn,
      query: {
        subscriptions: { findFirst, findMany },
      },
    } as any,
    selectFn,
    selectFromFn,
    selectWhereFn,
    findFirst,
    findMany,
    insertFn,
    insertValuesFn,
    insertReturningFn,
    updateFn,
    updateSetFn,
    updateWhereFn,
    updateReturningFn,
  }
}

/**
 * Builds a fake subscription row that looks like what the DB would return.
 */
const fakeSubscriptionRow = (overrides: Record<string, any> = {}) => ({
  id: `sub-1`,
  userId: `user-1`,
  stripeCustomerId: `cus_test1`,
  stripeSubscriptionId: `sub_test1`,
  stripePriceId: `price_test1`,
  tier: `free`,
  status: `active`,
  seats: 1,
  createdAt: new Date(),
  updatedAt: new Date(),
  ...overrides,
})

describe(`Subscription service`, () => {
  let mocks: ReturnType<typeof createMockDb>
  let service: Subscription

  beforeEach(() => {
    vi.clearAllMocks()
    mocks = createMockDb()
    service = new Subscription({ db: mocks.db } as any)
  })

  // ---------- constructor ----------
  describe(`constructor`, () => {
    it(`should instantiate with the subscriptions table`, () => {
      expect(service).toBeInstanceOf(Subscription)
      expect(service.name).toBe(`subscriptions`)
    })
  })

  // ---------- model ----------
  describe(`model`, () => {
    it(`should create a SubscriptionModel from data`, () => {
      const row = fakeSubscriptionRow()
      const result = service.model(row as any)

      expect(result).toBeDefined()
      // @ts-ignore
      expect(result._isModel).toBe(true)
      expect(result.userId).toBe(`user-1`)
      expect(result.stripeCustomerId).toBe(`cus_test1`)
      expect(result.tier).toBe(`free`)
      expect(result.seats).toBe(1)
    })
  })

  // ---------- findByUser ----------
  describe(`findByUser`, () => {
    it(`should return a model when the subscription is found`, async () => {
      const row = fakeSubscriptionRow()
      mocks.selectWhereFn.mockResolvedValue([row])

      const result = await service.findByUser(`user-1`)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      // @ts-ignore
      expect(result.data._isModel).toBe(true)
      expect(result.data.userId).toBe(`user-1`)

      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(mocks.selectFromFn).toHaveBeenCalledOnce()
      expect(mocks.selectWhereFn).toHaveBeenCalledOnce()
    })

    it(`should pass the correct eq condition for userId`, async () => {
      const { eq } = await import(`drizzle-orm`)
      const row = fakeSubscriptionRow()
      mocks.selectWhereFn.mockResolvedValue([row])

      await service.findByUser(`user-42`)

      expect(eq).toHaveBeenCalledWith(
        expect.objectContaining({ name: `user_id` }),
        `user-42`
      )
    })

    it(`should return error when subscription is not found (empty array)`, async () => {
      mocks.selectWhereFn.mockResolvedValue([])

      const result = await service.findByUser(`user-missing`)

      expect(result.error).toBeDefined()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe(`Subscription not found`)
      expect(result.data).toBeUndefined()
    })

    it(`should return error when the result is undefined`, async () => {
      mocks.selectWhereFn.mockResolvedValue([undefined])

      const result = await service.findByUser(`user-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Subscription not found`)
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`DB connection failed`))

      const result = await service.findByUser(`user-1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`DB connection failed`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- findByStripeSubscriptionId ----------
  describe(`findByStripeSubscriptionId`, () => {
    it(`should return a model when the subscription is found`, async () => {
      const row = fakeSubscriptionRow({ stripeSubscriptionId: `sub_abc123` })
      mocks.selectWhereFn.mockResolvedValue([row])

      const result = await service.findByStripeSubscriptionId(`sub_abc123`)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      // @ts-ignore
      expect(result.data._isModel).toBe(true)
      expect(result.data.stripeSubscriptionId).toBe(`sub_abc123`)

      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(mocks.selectFromFn).toHaveBeenCalledOnce()
      expect(mocks.selectWhereFn).toHaveBeenCalledOnce()
    })

    it(`should pass the correct eq condition for stripeSubscriptionId`, async () => {
      const { eq } = await import(`drizzle-orm`)
      const row = fakeSubscriptionRow()
      mocks.selectWhereFn.mockResolvedValue([row])

      await service.findByStripeSubscriptionId(`sub_xyz789`)

      expect(eq).toHaveBeenCalledWith(
        expect.objectContaining({ name: `stripe_subscription_id` }),
        `sub_xyz789`
      )
    })

    it(`should return error when subscription is not found (empty array)`, async () => {
      mocks.selectWhereFn.mockResolvedValue([])

      const result = await service.findByStripeSubscriptionId(`sub_missing`)

      expect(result.error).toBeDefined()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe(`Subscription not found`)
      expect(result.data).toBeUndefined()
    })

    it(`should return error when the result is undefined`, async () => {
      mocks.selectWhereFn.mockResolvedValue([undefined])

      const result = await service.findByStripeSubscriptionId(`sub_test1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Subscription not found`)
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`Connection lost`))

      const result = await service.findByStripeSubscriptionId(`sub_test1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Connection lost`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- findByStripeCustomerId ----------
  describe(`findByStripeCustomerId`, () => {
    it(`should return a model when the subscription is found`, async () => {
      const row = fakeSubscriptionRow({ stripeCustomerId: `cus_abc123` })
      mocks.selectWhereFn.mockResolvedValue([row])

      const result = await service.findByStripeCustomerId(`cus_abc123`)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      // @ts-ignore
      expect(result.data._isModel).toBe(true)
      expect(result.data.stripeCustomerId).toBe(`cus_abc123`)

      expect(mocks.selectFn).toHaveBeenCalledOnce()
      expect(mocks.selectFromFn).toHaveBeenCalledOnce()
      expect(mocks.selectWhereFn).toHaveBeenCalledOnce()
    })

    it(`should pass the correct eq condition for stripeCustomerId`, async () => {
      const { eq } = await import(`drizzle-orm`)
      const row = fakeSubscriptionRow()
      mocks.selectWhereFn.mockResolvedValue([row])

      await service.findByStripeCustomerId(`cus_xyz789`)

      expect(eq).toHaveBeenCalledWith(
        expect.objectContaining({ name: `stripe_customer_id` }),
        `cus_xyz789`
      )
    })

    it(`should return error when subscription is not found (empty array)`, async () => {
      mocks.selectWhereFn.mockResolvedValue([])

      const result = await service.findByStripeCustomerId(`cus_missing`)

      expect(result.error).toBeDefined()
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error.message).toBe(`Subscription not found`)
      expect(result.data).toBeUndefined()
    })

    it(`should return error when the result is undefined`, async () => {
      mocks.selectWhereFn.mockResolvedValue([undefined])

      const result = await service.findByStripeCustomerId(`cus_test1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Subscription not found`)
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`Connection lost`))

      const result = await service.findByStripeCustomerId(`cus_test1`)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Connection lost`)
      expect(result.data).toBeUndefined()
    })
  })

  // ---------- upsertByUser ----------
  describe(`upsertByUser`, () => {
    it(`should create a new subscription when none exists for user`, async () => {
      const newRow = fakeSubscriptionRow({ userId: `user-new`, tier: `solo` })

      // No existing subscription found
      mocks.selectWhereFn.mockResolvedValue([])
      // Insert returns the new row
      mocks.insertReturningFn.mockResolvedValue([newRow])

      const result = await service.upsertByUser({
        userId: `user-new`,
        tier: `solo`,
        status: `active`,
        stripeCustomerId: `cus_new`,
      } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.userId).toBe(`user-new`)
      expect(mocks.insertFn).toHaveBeenCalledOnce()
    })

    it(`should update existing subscription when one exists for user`, async () => {
      const existingRow = fakeSubscriptionRow({ userId: `user-existing`, tier: `free` })
      const updatedRow = fakeSubscriptionRow({
        userId: `user-existing`,
        tier: `pro`,
      })

      // Existing subscription found
      mocks.selectWhereFn.mockResolvedValue([existingRow])
      // Update returns the updated row
      mocks.updateReturningFn.mockResolvedValue([updatedRow])

      const result = await service.upsertByUser({
        userId: `user-existing`,
        tier: `pro`,
        status: `active`,
        stripeCustomerId: `cus_existing`,
      } as any)

      expect(result.data).toBeDefined()
      expect(result.error).toBeUndefined()
      expect(result.data._isModel).toBe(true)
      expect(result.data.tier).toBe(`pro`)
      expect(mocks.updateFn).toHaveBeenCalledOnce()
    })

    it(`should return error when userId is empty`, async () => {
      const result = await service.upsertByUser({
        userId: ``,
        tier: `solo`,
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`userId is required for upsertByUser`)
      expect(result.data).toBeUndefined()
    })

    it(`should return error when insert fails`, async () => {
      mocks.selectWhereFn.mockResolvedValue([])
      mocks.insertReturningFn.mockResolvedValue([])

      const result = await service.upsertByUser({
        userId: `user-fail`,
        tier: `solo`,
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Failed to create subscription`)
    })

    it(`should return error when update fails`, async () => {
      const existingRow = fakeSubscriptionRow()
      mocks.selectWhereFn.mockResolvedValue([existingRow])
      mocks.updateReturningFn.mockResolvedValue([])

      const result = await service.upsertByUser({
        userId: `user-1`,
        tier: `pro`,
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Failed to update subscription`)
    })

    it(`should return error on DB exception`, async () => {
      mocks.selectWhereFn.mockRejectedValue(new Error(`Connection reset`))

      const result = await service.upsertByUser({
        userId: `user-1`,
        tier: `solo`,
      } as any)

      expect(result.error).toBeDefined()
      expect(result.error.message).toBe(`Connection reset`)
      expect(result.data).toBeUndefined()
    })

    it(`should set updatedAt on update`, async () => {
      const existingRow = fakeSubscriptionRow()
      const updatedRow = fakeSubscriptionRow({ tier: `pro` })

      mocks.selectWhereFn.mockResolvedValue([existingRow])
      mocks.updateReturningFn.mockResolvedValue([updatedRow])

      const before = Date.now()
      await service.upsertByUser({
        userId: `user-1`,
        tier: `pro`,
      } as any)
      const after = Date.now()

      expect(mocks.updateSetFn).toHaveBeenCalledOnce()
      const setArg = (mocks.updateSetFn.mock.calls[0] as any)[0]
      expect(setArg.updatedAt).toBeInstanceOf(Date)
      expect(setArg.updatedAt.getTime()).toBeGreaterThanOrEqual(before)
      expect(setArg.updatedAt.getTime()).toBeLessThanOrEqual(after)
    })
  })
})

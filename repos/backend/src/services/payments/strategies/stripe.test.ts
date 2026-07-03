import type { TApp, TPayConfig } from '@TBE/types'
import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock logger before any imports that use it
vi.mock(`@TBE/utils/logger`, () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Mock getBillingPeriod
vi.mock(`@TBE/utils/auth/getBillingPeriod`, () => ({
  getBillingPeriod: vi.fn(() => `2026-04`),
}))

// Mock the stripe SDK - returns a factory that we control from tests
const mockSubscriptionsRetrieve = vi.fn()
const mockSubscriptionsUpdate = vi.fn()
const mockWebhooksConstructEvent = vi.fn()
const mockCustomersCreate = vi.fn()
const mockCustomersRetrieve = vi.fn()
const mockCheckoutSessionsCreate = vi.fn()
const mockBillingPortalSessionsCreate = vi.fn()
const mockSubscriptionItemsUpdate = vi.fn()
const mockInvoicesList = vi.fn()
const mockPricesRetrieve = vi.fn()

vi.mock(`stripe`, () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: { create: mockCustomersCreate, retrieve: mockCustomersRetrieve },
      checkout: { sessions: { create: mockCheckoutSessionsCreate } },
      billingPortal: { sessions: { create: mockBillingPortalSessionsCreate } },
      subscriptions: {
        retrieve: mockSubscriptionsRetrieve,
        update: mockSubscriptionsUpdate,
      },
      subscriptionItems: { update: mockSubscriptionItemsUpdate },
      invoices: { list: mockInvoicesList },
      prices: { retrieve: mockPricesRetrieve },
      webhooks: { constructEvent: mockWebhooksConstructEvent },
    })),
  }
})

import StripeSdk from 'stripe'
import { logger } from '@TBE/utils/logger'
import { ESubscriptionTier } from '@tdsk/domain'
import { StripeService } from './stripe'

const testConfig: TPayConfig = {
  type: `stripe`,
  secretKey: `sk_test_123`,
  webhookSecret: `whsec_test_123`,
  priceIds: {
    solo: `price_solo_123`,
    pro: `price_pro_123`,
    team: `price_team_123`,
  },
  seatPriceIds: {
    pro: `seat_pro_123`,
    team: `seat_team_123`,
  },
  environment: `test`,
}

/**
 * Build a mock db services object matching TApp['locals']['db']
 */
const createMockDb = () => ({
  services: {
    subscription: {
      findByStripeCustomerId: vi.fn(),
      findByStripeSubscriptionId: vi.fn(),
      upsertByUser: vi.fn().mockResolvedValue({ data: {} }),
    },
    invoice: {
      upsertByStripeId: vi.fn().mockResolvedValue({ data: {} }),
    },
    org: {
      list: vi.fn().mockResolvedValue({ data: [] }),
    },
    quota: {
      initializePeriod: vi.fn().mockResolvedValue({ data: {} }),
      getUsage: vi.fn().mockResolvedValue({ data: null }),
    },
  },
})

const createMockApp = (db: ReturnType<typeof createMockDb>) =>
  ({ locals: { db } }) as unknown as TApp

describe(`StripeService`, () => {
  let service: StripeService
  let mockDb: ReturnType<typeof createMockDb>
  let mockApp: TApp

  beforeEach(() => {
    vi.clearAllMocks()
    service = new StripeService(testConfig)
    mockDb = createMockDb()
    mockApp = createMockApp(mockDb)
  })

  describe(`fetchPlans`, () => {
    const mockStripePrice = (
      unitAmount: number,
      interval = `month`,
      currency = `usd`
    ) => ({
      unit_amount: unitAmount,
      recurring: { interval },
      currency,
    })

    it(`should fetch prices from Stripe and return plans with correct fields`, async () => {
      mockPricesRetrieve.mockImplementation((id: string) => {
        const prices: Record<string, any> = {
          price_solo_123: mockStripePrice(1500),
          price_pro_123: mockStripePrice(3900),
          price_team_123: mockStripePrice(9900),
          seat_pro_123: mockStripePrice(1000),
          seat_team_123: mockStripePrice(800),
        }
        return Promise.resolve(prices[id])
      })

      const { data, error } = await service.fetchPlans()

      expect(error).toBeUndefined()
      expect(data).toHaveLength(4)

      const free = data!.find((p) => p.id === `free`)!
      expect(free.price).toBe(0)
      expect(free.seatPrice).toBe(0)
      expect(free.interval).toBe(`month`)
      expect(free.currency).toBe(`usd`)

      const solo = data!.find((p) => p.id === `solo`)!
      expect(solo.price).toBe(1500)
      expect(solo.seatPrice).toBe(0)
      expect(solo.name).toBe(`Solo`)

      const pro = data!.find((p) => p.id === `pro`)!
      expect(pro.price).toBe(3900)
      expect(pro.seatPrice).toBe(1000)

      const team = data!.find((p) => p.id === `team`)!
      expect(team.price).toBe(9900)
      expect(team.seatPrice).toBe(800)
    })

    it(`should return cached plans on second call within TTL`, async () => {
      mockPricesRetrieve.mockResolvedValue(mockStripePrice(1500))

      await service.fetchPlans()
      const callCount = mockPricesRetrieve.mock.calls.length

      const { data } = await service.fetchPlans()

      expect(data).toBeDefined()
      expect(mockPricesRetrieve.mock.calls.length).toBe(callCount)
    })

    it(`should refetch after cache TTL expires`, async () => {
      mockPricesRetrieve.mockResolvedValue(mockStripePrice(1500))

      await service.fetchPlans()
      const callCount = mockPricesRetrieve.mock.calls.length

      const dateNowSpy = vi.spyOn(Date, `now`).mockReturnValue(Date.now() + 300_001)

      await service.fetchPlans()

      expect(mockPricesRetrieve.mock.calls.length).toBeGreaterThan(callCount)

      dateNowSpy.mockRestore()
    })

    it(`should return error when Stripe fails with no cache`, async () => {
      mockPricesRetrieve.mockRejectedValue(new Error(`Stripe down`))

      const { data, error } = await service.fetchPlans()

      expect(data).toBeUndefined()
      expect(error).toBeDefined()
      expect(error!.status).toBe(500)
      expect(error!.message).toBe(`Stripe down`)
    })

    it(`should return stale cache when Stripe fails after a successful fetch`, async () => {
      mockPricesRetrieve.mockResolvedValue(mockStripePrice(1500))
      const firstResult = await service.fetchPlans()
      expect(firstResult.data).toBeDefined()

      const dateNowSpy = vi.spyOn(Date, `now`).mockReturnValue(Date.now() + 300_001)
      mockPricesRetrieve.mockRejectedValue(new Error(`Stripe down`))

      const { data, error } = await service.fetchPlans()

      expect(error).toBeUndefined()
      expect(data).toBeDefined()
      expect(data!.length).toBe(firstResult.data!.length)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`Serving stale plans cache`)
      )

      dateNowSpy.mockRestore()
    })

    it(`should set price to 0 for tiers without a priceId`, async () => {
      mockPricesRetrieve.mockResolvedValue(mockStripePrice(1500))

      const { data } = await service.fetchPlans()
      const free = data!.find((p) => p.id === `free`)!

      expect(free.price).toBe(0)
      expect(free.seatPrice).toBe(0)
      expect(mockPricesRetrieve).not.toHaveBeenCalledWith(undefined)
    })

    it(`should handle null unit_amount from Stripe`, async () => {
      mockPricesRetrieve.mockResolvedValue({
        unit_amount: null,
        recurring: { interval: `month` },
        currency: `usd`,
      })

      const { data } = await service.fetchPlans()
      const solo = data!.find((p) => p.id === `solo`)!

      expect(solo.price).toBe(0)
    })

    it(`should include limits from PlanLimits on each plan`, async () => {
      mockPricesRetrieve.mockResolvedValue(mockStripePrice(1500))

      const { data } = await service.fetchPlans()

      for (const plan of data!) {
        expect(plan.limits).toBeDefined()
        expect(plan.limits.projects).toBeDefined()
        expect(plan.limits.seats).toBeDefined()
      }
    })
  })

  describe(`webhook event dispatch`, () => {
    it(`should dispatch checkout.session.completed to handleCheckoutCompleted`, async () => {
      const session = {
        subscription: `sub_123`,
        customer: `cus_123`,
        metadata: { tier: `solo` },
      }

      mockSubscriptionsRetrieve.mockResolvedValue({
        status: `active`,
        cancel_at_period_end: false,
        items: {
          data: [
            {
              price: { id: `price_solo_123` },
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            },
          ],
        },
      })

      mockDb.services.subscription.findByStripeCustomerId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      await service.webhook(mockApp, {
        type: `checkout.session.completed`,
        data: { object: session },
      } as any)

      expect(mockDb.services.subscription.upsertByUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: `user_1`,
          tier: `solo`,
          status: `active`,
          stripeCustomerId: `cus_123`,
          stripeSubscriptionId: `sub_123`,
        })
      )
    })

    it(`should fall back to customer metadata userId when no local subscription matches`, async () => {
      const session = {
        subscription: `sub_456`,
        customer: `cus_456`,
        metadata: { tier: `solo` },
      }

      mockSubscriptionsRetrieve.mockResolvedValue({
        status: `active`,
        cancel_at_period_end: false,
        items: {
          data: [
            {
              price: { id: `price_solo_123` },
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            },
          ],
        },
      })

      // No local subscription has this stripeCustomerId
      mockDb.services.subscription.findByStripeCustomerId.mockResolvedValue({
        data: null,
      })

      // The Stripe customer carries the userId in metadata
      mockCustomersRetrieve.mockResolvedValue({
        id: `cus_456`,
        deleted: false,
        metadata: { userId: `user_2` },
      })

      await service.webhook(mockApp, {
        type: `checkout.session.completed`,
        data: { object: session },
      } as any)

      expect(mockCustomersRetrieve).toHaveBeenCalledWith(`cus_456`)
      expect(mockDb.services.subscription.upsertByUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: `user_2`,
          tier: `solo`,
          stripeCustomerId: `cus_456`,
          stripeSubscriptionId: `sub_456`,
        })
      )
    })

    it(`should dispatch customer.subscription.updated to handleSubscriptionUpdated`, async () => {
      const sub = {
        id: `sub_123`,
        status: `active`,
        cancel_at_period_end: false,
        items: {
          data: [
            {
              price: { id: `price_pro_123` },
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            },
          ],
        },
      }

      mockDb.services.subscription.findByStripeSubscriptionId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      await service.webhook(mockApp, {
        type: `customer.subscription.updated`,
        data: { object: sub },
      } as any)

      expect(mockDb.services.subscription.upsertByUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: `user_1`,
          tier: `pro`,
          status: `active`,
          cancelAtPeriodEnd: false,
        })
      )
    })

    it(`should set cancelAtPeriodEnd when subscription is cancelled at period end`, async () => {
      const sub = {
        id: `sub_123`,
        status: `active`,
        cancel_at_period_end: true,
        items: {
          data: [
            {
              price: { id: `price_solo_123` },
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            },
          ],
        },
      }

      mockDb.services.subscription.findByStripeSubscriptionId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      await service.webhook(mockApp, {
        type: `customer.subscription.updated`,
        data: { object: sub },
      } as any)

      expect(mockDb.services.subscription.upsertByUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: `user_1`,
          tier: `solo`,
          status: `active`,
          cancelAtPeriodEnd: true,
        })
      )
    })

    it(`should set cancelAtPeriodEnd when portal uses cancel_at instead of cancel_at_period_end`, async () => {
      const sub = {
        id: `sub_123`,
        status: `active`,
        cancel_at_period_end: false,
        cancel_at: 1702592000,
        items: {
          data: [
            {
              price: { id: `price_solo_123` },
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            },
          ],
        },
      }

      mockDb.services.subscription.findByStripeSubscriptionId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      await service.webhook(mockApp, {
        type: `customer.subscription.updated`,
        data: { object: sub },
      } as any)

      expect(mockDb.services.subscription.upsertByUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: `user_1`,
          tier: `solo`,
          status: `active`,
          cancelAtPeriodEnd: true,
        })
      )
    })

    it(`should dispatch customer.subscription.deleted to handleSubscriptionDeleted`, async () => {
      const sub = {
        id: `sub_123`,
        items: {
          data: [
            {
              current_period_end: 1702592000,
            },
          ],
        },
      }

      mockDb.services.subscription.findByStripeSubscriptionId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      await service.webhook(mockApp, {
        type: `customer.subscription.deleted`,
        data: { object: sub },
      } as any)

      expect(mockDb.services.subscription.upsertByUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: `user_1`,
          tier: ESubscriptionTier.free,
          status: `canceled`,
          cancelAtPeriodEnd: false,
        })
      )
    })

    it(`should dispatch invoice.paid to handleInvoicePaid`, async () => {
      const invoice = {
        id: `inv_123`,
        customer: `cus_123`,
        amount_paid: 1999,
        currency: `usd`,
        billing_reason: `subscription_create`,
        hosted_invoice_url: `https://pay.stripe.com/inv_123`,
      }

      mockDb.services.subscription.findByStripeCustomerId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      await service.webhook(mockApp, {
        type: `invoice.paid`,
        data: { object: invoice },
      } as any)

      expect(mockDb.services.invoice.upsertByStripeId).toHaveBeenCalledWith(
        `inv_123`,
        expect.objectContaining({
          userId: `user_1`,
          amount: 1999,
          status: `paid`,
        })
      )
    })

    it(`should dispatch invoice.payment_failed to handleInvoicePaymentFailed`, async () => {
      const invoice = {
        id: `inv_fail_123`,
        customer: `cus_123`,
        amount_due: 1999,
        currency: `usd`,
        hosted_invoice_url: `https://pay.stripe.com/inv_fail_123`,
      }

      mockDb.services.subscription.findByStripeCustomerId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      await service.webhook(mockApp, {
        type: `invoice.payment_failed`,
        data: { object: invoice },
      } as any)

      expect(mockDb.services.subscription.upsertByUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: `user_1`,
          status: `past_due`,
        })
      )
    })

    it(`should log unhandled event types without throwing`, async () => {
      await service.webhook(mockApp, {
        type: `payment_intent.succeeded`,
        data: { object: {} },
      } as any)

      expect(logger.info).toHaveBeenCalledWith(
        expect.stringContaining(`Unhandled webhook event type: payment_intent.succeeded`)
      )
    })
  })

  describe(`#handleCheckoutCompleted error handling`, () => {
    it(`should throw when subscription ID is missing`, async () => {
      const session = { subscription: null, customer: `cus_123` }

      await expect(
        service.webhook(mockApp, {
          type: `checkout.session.completed`,
          data: { object: session },
        } as any)
      ).rejects.toThrow(`missing subscription or customer ID`)
    })

    it(`should throw when customer ID is missing`, async () => {
      const session = { subscription: `sub_123`, customer: null }

      await expect(
        service.webhook(mockApp, {
          type: `checkout.session.completed`,
          data: { object: session },
        } as any)
      ).rejects.toThrow(`missing subscription or customer ID`)
    })

    it(`should throw when no user found for customer`, async () => {
      const session = {
        subscription: `sub_123`,
        customer: `cus_orphan`,
        metadata: {},
      }

      mockSubscriptionsRetrieve.mockResolvedValue({
        status: `active`,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: `price_solo_123` } }] },
      })

      mockDb.services.subscription.findByStripeCustomerId.mockResolvedValue({
        data: null,
      })

      // Metadata fallback also finds no userId on the Stripe customer
      mockCustomersRetrieve.mockResolvedValue({
        id: `cus_orphan`,
        deleted: false,
        metadata: {},
      })

      await expect(
        service.webhook(mockApp, {
          type: `checkout.session.completed`,
          data: { object: session },
        } as any)
      ).rejects.toThrow(`No user found for customer cus_orphan`)
    })

    it(`should throw when upsertByUser returns error`, async () => {
      const session = {
        subscription: `sub_123`,
        customer: `cus_123`,
        metadata: { tier: `solo` },
      }

      mockSubscriptionsRetrieve.mockResolvedValue({
        status: `active`,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: `price_solo_123` } }] },
      })

      mockDb.services.subscription.findByStripeCustomerId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      mockDb.services.subscription.upsertByUser.mockResolvedValue({
        error: new Error(`DB write failed`),
      })

      await expect(
        service.webhook(mockApp, {
          type: `checkout.session.completed`,
          data: { object: session },
        } as any)
      ).rejects.toThrow(`Failed to upsert subscription for user user_1`)
    })
  })

  describe(`#tierFromPriceId`, () => {
    it(`should log error for unknown price IDs`, async () => {
      // Trigger tierFromPriceId through subscription.updated with an unknown price
      const sub = {
        id: `sub_123`,
        status: `active`,
        cancel_at_period_end: false,
        items: {
          data: [
            {
              price: { id: `price_unknown_999` },
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            },
          ],
        },
      }

      mockDb.services.subscription.findByStripeSubscriptionId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      await service.webhook(mockApp, {
        type: `customer.subscription.updated`,
        data: { object: sub },
      } as any)

      expect(logger.error).toHaveBeenCalledWith(
        expect.stringContaining(`Unknown priceId "price_unknown_999"`)
      )

      // Should still default to free tier in the upsert call
      expect(mockDb.services.subscription.upsertByUser).toHaveBeenCalledWith(
        expect.objectContaining({ tier: ESubscriptionTier.free })
      )
    })

    it(`should correctly resolve known price IDs`, async () => {
      const sub = {
        id: `sub_123`,
        status: `active`,
        cancel_at_period_end: false,
        items: {
          data: [
            {
              price: { id: `price_team_123` },
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            },
          ],
        },
      }

      mockDb.services.subscription.findByStripeSubscriptionId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      await service.webhook(mockApp, {
        type: `customer.subscription.updated`,
        data: { object: sub },
      } as any)

      expect(logger.error).not.toHaveBeenCalled()
      expect(mockDb.services.subscription.upsertByUser).toHaveBeenCalledWith(
        expect.objectContaining({ tier: `team` })
      )
    })
  })

  describe(`#handleInvoicePaid quota reset`, () => {
    it(`should only reset quotas for subscription_cycle billing reason`, async () => {
      const invoice = {
        id: `inv_cycle`,
        customer: `cus_123`,
        amount_paid: 1999,
        currency: `usd`,
        billing_reason: `subscription_cycle`,
        hosted_invoice_url: `https://pay.stripe.com/inv_cycle`,
      }

      mockDb.services.subscription.findByStripeCustomerId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      mockDb.services.org.list.mockResolvedValue({
        data: [{ id: `org_1` }, { id: `org_2` }],
      })

      mockDb.services.quota.getUsage.mockResolvedValue({
        data: {
          projects: 5,
          endpoints: 3,
          secrets: 2,
          compute: 100,
          threads: 50,
          messages: 200,
        },
      })

      await service.webhook(mockApp, {
        type: `invoice.paid`,
        data: { object: invoice },
      } as any)

      // Should fetch usage from the PREVIOUS period (not the new period)
      const now = new Date()
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevPeriod = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
      expect(mockDb.services.quota.getUsage).toHaveBeenCalledWith(`org_1`, prevPeriod)
      expect(mockDb.services.quota.getUsage).toHaveBeenCalledWith(`org_2`, prevPeriod)

      // Should call initializePeriod for each org with stock counters carried forward
      expect(mockDb.services.quota.initializePeriod).toHaveBeenCalledTimes(2)
      expect(mockDb.services.quota.initializePeriod).toHaveBeenCalledWith(
        `org_1`,
        `2026-04`,
        { projects: 5, endpoints: 3, secrets: 2 }
      )
      expect(mockDb.services.quota.initializePeriod).toHaveBeenCalledWith(
        `org_2`,
        `2026-04`,
        { projects: 5, endpoints: 3, secrets: 2 }
      )
    })

    it(`should NOT reset quotas for subscription_create billing reason`, async () => {
      const invoice = {
        id: `inv_create`,
        customer: `cus_123`,
        amount_paid: 1999,
        currency: `usd`,
        billing_reason: `subscription_create`,
        hosted_invoice_url: null,
      }

      mockDb.services.subscription.findByStripeCustomerId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      await service.webhook(mockApp, {
        type: `invoice.paid`,
        data: { object: invoice },
      } as any)

      expect(mockDb.services.quota.initializePeriod).not.toHaveBeenCalled()
      expect(mockDb.services.invoice.upsertByStripeId).toHaveBeenCalled()
    })

    it(`should throw when customer ID is missing`, async () => {
      const invoice = {
        id: `inv_no_cust`,
        customer: null,
        amount_paid: 0,
        currency: `usd`,
      }

      await expect(
        service.webhook(mockApp, {
          type: `invoice.paid`,
          data: { object: invoice },
        } as any)
      ).rejects.toThrow(`invoice.paid missing customer ID`)
    })

    it(`should throw when no subscription found for customer`, async () => {
      const invoice = {
        id: `inv_orphan`,
        customer: `cus_missing`,
        amount_paid: 0,
        currency: `usd`,
      }

      mockDb.services.subscription.findByStripeCustomerId.mockResolvedValue({
        data: null,
      })

      await expect(
        service.webhook(mockApp, {
          type: `invoice.paid`,
          data: { object: invoice },
        } as any)
      ).rejects.toThrow(
        `No subscription found for customer cus_missing during invoice.paid`
      )
    })

    it(`should carry forward zero counters when no previous usage exists`, async () => {
      const invoice = {
        id: `inv_fresh`,
        customer: `cus_123`,
        amount_paid: 1999,
        currency: `usd`,
        billing_reason: `subscription_cycle`,
      }

      mockDb.services.subscription.findByStripeCustomerId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      mockDb.services.org.list.mockResolvedValue({
        data: [{ id: `org_1` }],
      })

      mockDb.services.quota.getUsage.mockResolvedValue({ data: null })

      await service.webhook(mockApp, {
        type: `invoice.paid`,
        data: { object: invoice },
      } as any)

      expect(mockDb.services.quota.initializePeriod).toHaveBeenCalledWith(
        `org_1`,
        `2026-04`,
        { projects: 0, endpoints: 0, secrets: 0 }
      )
    })
  })

  describe(`#handleSubscriptionDeleted`, () => {
    it(`should revert to free tier when subscription is deleted`, async () => {
      const sub = {
        id: `sub_deleted`,
        items: {
          data: [{ current_period_end: 1702592000 }],
        },
      }

      mockDb.services.subscription.findByStripeSubscriptionId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      await service.webhook(mockApp, {
        type: `customer.subscription.deleted`,
        data: { object: sub },
      } as any)

      expect(mockDb.services.subscription.upsertByUser).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: `user_1`,
          tier: ESubscriptionTier.free,
          status: `canceled`,
          cancelAtPeriodEnd: false,
        })
      )
    })

    it(`should throw when no local subscription found`, async () => {
      const sub = {
        id: `sub_unknown`,
        items: { data: [] },
      }

      mockDb.services.subscription.findByStripeSubscriptionId.mockResolvedValue({
        data: null,
      })

      await expect(
        service.webhook(mockApp, {
          type: `customer.subscription.deleted`,
          data: { object: sub },
        } as any)
      ).rejects.toThrow(
        `No local subscription found for deleted stripe subscription sub_unknown`
      )
    })

    it(`should throw when upsert fails`, async () => {
      const sub = {
        id: `sub_fail`,
        items: { data: [] },
      }

      mockDb.services.subscription.findByStripeSubscriptionId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      mockDb.services.subscription.upsertByUser.mockResolvedValue({
        error: new Error(`DB constraint violation`),
      })

      await expect(
        service.webhook(mockApp, {
          type: `customer.subscription.deleted`,
          data: { object: sub },
        } as any)
      ).rejects.toThrow(`Failed to revert subscription sub_fail to free`)
    })
  })

  describe(`#handleInvoicePaymentFailed`, () => {
    it(`should set subscription to past_due`, async () => {
      const invoice = {
        id: `inv_fail`,
        customer: `cus_123`,
        amount_due: 2999,
        currency: `usd`,
        hosted_invoice_url: `https://pay.stripe.com/inv_fail`,
      }

      mockDb.services.subscription.findByStripeCustomerId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      await service.webhook(mockApp, {
        type: `invoice.payment_failed`,
        data: { object: invoice },
      } as any)

      expect(mockDb.services.subscription.upsertByUser).toHaveBeenCalledWith({
        userId: `user_1`,
        status: `past_due`,
      })
      expect(mockDb.services.invoice.upsertByStripeId).toHaveBeenCalledWith(
        `inv_fail`,
        expect.objectContaining({
          userId: `user_1`,
          status: `failed`,
          amount: 2999,
        })
      )
    })

    it(`should throw when customer ID is missing`, async () => {
      const invoice = {
        id: `inv_no_cust`,
        customer: null,
        amount_due: 0,
        currency: `usd`,
      }

      await expect(
        service.webhook(mockApp, {
          type: `invoice.payment_failed`,
          data: { object: invoice },
        } as any)
      ).rejects.toThrow(`invoice.payment_failed missing customer ID`)
    })

    it(`should throw when no subscription found`, async () => {
      const invoice = {
        id: `inv_orphan`,
        customer: `cus_missing`,
        amount_due: 0,
        currency: `usd`,
      }

      mockDb.services.subscription.findByStripeCustomerId.mockResolvedValue({
        data: null,
      })

      await expect(
        service.webhook(mockApp, {
          type: `invoice.payment_failed`,
          data: { object: invoice },
        } as any)
      ).rejects.toThrow(
        `No subscription found for customer cus_missing during invoice.payment_failed`
      )
    })

    it(`should throw when upsert fails`, async () => {
      const invoice = {
        id: `inv_fail`,
        customer: `cus_123`,
        amount_due: 0,
        currency: `usd`,
      }

      mockDb.services.subscription.findByStripeCustomerId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      mockDb.services.subscription.upsertByUser.mockResolvedValue({
        error: new Error(`DB timeout`),
      })

      await expect(
        service.webhook(mockApp, {
          type: `invoice.payment_failed`,
          data: { object: invoice },
        } as any)
      ).rejects.toThrow(`Failed to mark past_due subscription`)
    })
  })

  describe(`#handleSubscriptionUpdated error handling`, () => {
    it(`should throw when no local subscription found`, async () => {
      const sub = {
        id: `sub_unknown`,
        status: `active`,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: `price_solo_123` } }] },
      }

      mockDb.services.subscription.findByStripeSubscriptionId.mockResolvedValue({
        data: null,
      })

      await expect(
        service.webhook(mockApp, {
          type: `customer.subscription.updated`,
          data: { object: sub },
        } as any)
      ).rejects.toThrow(`No local subscription found for stripe subscription sub_unknown`)
    })

    it(`should throw when upsert fails`, async () => {
      const sub = {
        id: `sub_123`,
        status: `active`,
        cancel_at_period_end: false,
        items: { data: [{ price: { id: `price_solo_123` } }] },
      }

      mockDb.services.subscription.findByStripeSubscriptionId.mockResolvedValue({
        data: { userId: `user_1` },
      })

      mockDb.services.subscription.upsertByUser.mockResolvedValue({
        error: new Error(`DB write failed`),
      })

      await expect(
        service.webhook(mockApp, {
          type: `customer.subscription.updated`,
          data: { object: sub },
        } as any)
      ).rejects.toThrow(`Failed to update subscription sub_123`)
    })
  })

  describe(`retrieveSubscription`, () => {
    it(`should return reconciliation state from Stripe`, async () => {
      mockSubscriptionsRetrieve.mockResolvedValue({
        status: `active`,
        cancel_at_period_end: true,
        items: {
          data: [
            {
              price: { id: `price_solo_123` },
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            },
          ],
        },
      })

      const result = await service.retrieveSubscription(`sub_123`)

      expect(mockSubscriptionsRetrieve).toHaveBeenCalledWith(`sub_123`)
      expect(result).toEqual({
        tier: `solo`,
        status: `active`,
        stripePriceId: `price_solo_123`,
        cancelAtPeriodEnd: true,
        currentPeriodStart: new Date(1700000000 * 1000).toISOString(),
        currentPeriodEnd: new Date(1702592000 * 1000).toISOString(),
      })
    })

    it(`should detect cancel_at as cancelAtPeriodEnd even when cancel_at_period_end is false`, async () => {
      mockSubscriptionsRetrieve.mockResolvedValue({
        status: `active`,
        cancel_at_period_end: false,
        cancel_at: 1702592000,
        items: {
          data: [
            {
              price: { id: `price_solo_123` },
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            },
          ],
        },
      })

      const result = await service.retrieveSubscription(`sub_portal_cancel`)

      expect(result).toEqual({
        tier: `solo`,
        status: `active`,
        stripePriceId: `price_solo_123`,
        cancelAtPeriodEnd: true,
        currentPeriodStart: new Date(1700000000 * 1000).toISOString(),
        currentPeriodEnd: new Date(1702592000 * 1000).toISOString(),
      })
    })

    it(`should return cancelAtPeriodEnd false when neither cancel flag is set`, async () => {
      mockSubscriptionsRetrieve.mockResolvedValue({
        status: `active`,
        cancel_at_period_end: false,
        cancel_at: null,
        items: {
          data: [
            {
              price: { id: `price_pro_123` },
              current_period_start: 1700000000,
              current_period_end: 1702592000,
            },
          ],
        },
      })

      const result = await service.retrieveSubscription(`sub_active`)

      expect(result.cancelAtPeriodEnd).toBe(false)
    })
  })

  describe(`constructWebhookEvent`, () => {
    it(`should delegate to stripe.webhooks.constructEvent`, () => {
      const payload = Buffer.from(`test`)
      const sig = `t=123,v1=abc`

      mockWebhooksConstructEvent.mockReturnValue({ type: `test` })

      const result = service.constructWebhookEvent(payload, sig)

      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(
        payload,
        sig,
        testConfig.webhookSecret
      )
      expect(result).toEqual({ type: `test` })
    })

    it(`should skip verification when webhookSecret is empty in local env`, () => {
      const localService = new StripeService({
        ...testConfig,
        webhookSecret: ``,
        environment: `local`,
      })
      const event = { type: `invoice.paid`, data: { object: {} } }
      const payload = Buffer.from(JSON.stringify(event))

      const result = localService.constructWebhookEvent(payload, `t=123,v1=bad`)

      expect(mockWebhooksConstructEvent).not.toHaveBeenCalled()
      expect(result).toEqual(event)
    })

    it(`should skip verification when webhookSecret is empty in test env`, () => {
      const testEnvService = new StripeService({
        ...testConfig,
        webhookSecret: ``,
        environment: `test`,
      })
      const event = { type: `checkout.session.completed`, data: { object: {} } }
      const payload = Buffer.from(JSON.stringify(event))

      const result = testEnvService.constructWebhookEvent(payload, `t=123,v1=bad`)

      expect(mockWebhooksConstructEvent).not.toHaveBeenCalled()
      expect(result).toEqual(event)
    })

    it(`should still verify when webhookSecret is set even in non-production`, () => {
      mockWebhooksConstructEvent.mockReturnValue({ type: `test` })

      const localService = new StripeService({
        ...testConfig,
        webhookSecret: `whsec_local_test`,
        environment: `local`,
      })
      const payload = Buffer.from(`test`)

      localService.constructWebhookEvent(payload, `t=123,v1=abc`)

      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(
        payload,
        `t=123,v1=abc`,
        `whsec_local_test`
      )
    })

    it(`should always verify in production even with empty webhookSecret`, () => {
      const prodService = new StripeService({
        ...testConfig,
        webhookSecret: ``,
        environment: `production`,
      })
      const payload = Buffer.from(`test`)

      prodService.constructWebhookEvent(payload, `t=123,v1=abc`)

      expect(mockWebhooksConstructEvent).toHaveBeenCalledWith(payload, `t=123,v1=abc`, ``)
    })

    it(`should handle string payload in skip mode`, () => {
      const localService = new StripeService({
        ...testConfig,
        webhookSecret: ``,
        environment: `local`,
      })
      const event = { type: `invoice.paid`, data: { object: {} } }
      const payload = JSON.stringify(event) as unknown as Buffer

      const result = localService.constructWebhookEvent(payload, `t=123,v1=bad`)

      expect(mockWebhooksConstructEvent).not.toHaveBeenCalled()
      expect(result).toEqual(event)
    })

    it(`should log a warning when skipping verification`, () => {
      const localService = new StripeService({
        ...testConfig,
        webhookSecret: ``,
        environment: `local`,
      })
      const payload = Buffer.from(JSON.stringify({ type: `test` }))

      localService.constructWebhookEvent(payload, `t=123,v1=bad`)

      expect(logger.warn).toHaveBeenCalledWith(
        `[Stripe] Skipping webhook signature verification (no webhookSecret configured)`
      )
    })

    it(`should throw on malformed JSON in skip mode`, () => {
      const localService = new StripeService({
        ...testConfig,
        webhookSecret: ``,
        environment: `local`,
      })
      const payload = Buffer.from(`not valid json`)

      expect(() => localService.constructWebhookEvent(payload, `t=123,v1=bad`)).toThrow(
        SyntaxError
      )
    })

    it(`should skip verification when webhookSecret is undefined in non-production`, () => {
      const localService = new StripeService({
        ...testConfig,
        webhookSecret: undefined as any,
        environment: `local`,
      })
      const event = { type: `invoice.paid`, data: { object: {} } }
      const payload = Buffer.from(JSON.stringify(event))

      const result = localService.constructWebhookEvent(payload, `t=123,v1=bad`)

      expect(mockWebhooksConstructEvent).not.toHaveBeenCalled()
      expect(result).toEqual(event)
    })
  })

  describe(`missing secret key`, () => {
    const noKeyConfig: TPayConfig = { ...testConfig, secretKey: `` }
    const notConfiguredMsg = `Payments not configured — missing Stripe secret key`

    it(`should construct without throwing and without creating a Stripe client`, () => {
      // beforeEach constructs a keyed service, so reset the SDK call history
      vi.mocked(StripeSdk).mockClear()
      expect(() => new StripeService(noKeyConfig)).not.toThrow()
      expect(StripeSdk).not.toHaveBeenCalled()
    })

    it(`should return a clear error from caught operations when no key is configured`, async () => {
      const noKeyService = new StripeService(noKeyConfig)

      const { data, error } = await noKeyService.createCustomer(`a@b.com`, `user-1`)
      expect(data).toBeUndefined()
      expect(error?.message).toBe(notConfiguredMsg)

      const checkout = await noKeyService.createCheckoutSession(
        `pro`,
        `cus_1`,
        `https://ok`,
        `https://cancel`
      )
      expect(checkout.error?.message).toBe(notConfiguredMsg)

      const portal = await noKeyService.createPortalSession(`cus_1`)
      expect(portal.error?.message).toBe(notConfiguredMsg)

      const plans = await noKeyService.fetchPlans()
      expect(plans.data).toBeUndefined()
      expect(plans.error?.message).toBe(notConfiguredMsg)
    })

    it(`should throw the clear error from uncaught operations when no key is configured`, async () => {
      const noKeyService = new StripeService(noKeyConfig)

      await expect(noKeyService.retrieveSubscription(`sub_1`)).rejects.toThrow(
        notConfiguredMsg
      )
      await expect(noKeyService.cancelSubscription(`sub_1`)).rejects.toThrow(
        notConfiguredMsg
      )
      await expect(noKeyService.updateSubscription(`sub_1`, `price_1`)).rejects.toThrow(
        notConfiguredMsg
      )
      await expect(noKeyService.updateSeatQuantity(`sub_1`, 2)).rejects.toThrow(
        notConfiguredMsg
      )
      await expect(noKeyService.getInvoices(`cus_1`)).rejects.toThrow(notConfiguredMsg)
      expect(() =>
        new StripeService({
          ...noKeyConfig,
          environment: `production`,
        }).constructWebhookEvent(Buffer.from(`{}`), `sig`)
      ).toThrow(notConfiguredMsg)
    })

    it(`should still skip webhook verification in non-production without a client`, () => {
      const noKeyService = new StripeService({
        ...noKeyConfig,
        webhookSecret: ``,
        environment: `local`,
      })
      const event = { type: `invoice.paid`, data: { object: {} } }
      const payload = Buffer.from(JSON.stringify(event))

      expect(noKeyService.constructWebhookEvent(payload, `t=1,v1=x`)).toEqual(event)
    })

    it(`should create the Stripe client when a key is configured`, () => {
      new StripeService(testConfig)
      expect(StripeSdk).toHaveBeenCalledWith(testConfig.secretKey)
    })
  })
})

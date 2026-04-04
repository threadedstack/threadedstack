import type { TApp, TStripeConfig } from '@TBE/types'
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
const mockCheckoutSessionsCreate = vi.fn()
const mockBillingPortalSessionsCreate = vi.fn()
const mockSubscriptionItemsUpdate = vi.fn()
const mockInvoicesList = vi.fn()

vi.mock(`stripe`, () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      customers: { create: mockCustomersCreate },
      checkout: { sessions: { create: mockCheckoutSessionsCreate } },
      billingPortal: { sessions: { create: mockBillingPortalSessionsCreate } },
      subscriptions: {
        retrieve: mockSubscriptionsRetrieve,
        update: mockSubscriptionsUpdate,
      },
      subscriptionItems: { update: mockSubscriptionItemsUpdate },
      invoices: { list: mockInvoicesList },
      webhooks: { constructEvent: mockWebhooksConstructEvent },
    })),
  }
})

import { logger } from '@TBE/utils/logger'
import { ESubscriptionTier } from '@tdsk/domain'
import { StripeService } from './stripe'

const testConfig: TStripeConfig = {
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
      ).rejects.toThrow(`Failed to mark subscription as past_due`)
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
  })
})

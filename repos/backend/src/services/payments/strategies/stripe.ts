import type {
  TApp,
  TPlanResp,
  TStripeConfig,
  TPayCustomer,
  TPayPortalSession,
  TPayCheckoutSession,
} from '@TBE/types'

import Stripe from 'stripe'
import { logger } from '@TBE/utils/logger'
import { getBillingPeriod } from '@TBE/utils/auth/getBillingPeriod'
import { BaseService } from '@TBE/services/payments/strategies/base'
import { Plan, PlanLimits, PlanPrices, ESubscriptionTier } from '@tdsk/domain'

/**
 * Stripe payment service implementation.
 * Handles subscriptions, checkout, portal sessions, and webhook processing.
 */
export class StripeService extends BaseService {
  #stripe: Stripe

  constructor(config: TStripeConfig) {
    super(config)
    this.#stripe = new Stripe(config.secretKey)
  }

  /**
   * Return static plan objects derived from PlanLimits.
   * No API call needed since plan definitions are in code.
   */
  fetchPlans(): TPlanResp {
    const plans = Object.entries(PlanLimits).map(
      ([tier, limits]) =>
        new Plan({
          limits,
          id: tier,
          name: tier.charAt(0).toUpperCase() + tier.slice(1),
          price: PlanPrices[tier as ESubscriptionTier] ?? 0,
        })
    )

    return { data: plans }
  }

  /**
   * Create a Stripe customer
   */
  async createCustomer(
    email: string,
    userId: string
  ): Promise<{ data?: TPayCustomer; error?: Error }> {
    try {
      const customer = await this.#stripe.customers.create({
        email,
        metadata: { userId },
      })
      return {
        data: {
          id: customer.id,
          email: customer.email || email,
          metadata: { userId },
        },
      }
    } catch (err: unknown) {
      logger.error(`[StripeService] Failed to create customer:`, err)
      return { error: err as Error }
    }
  }

  /**
   * Create a Stripe Checkout session for a subscription
   */
  async createCheckoutSession(
    tier: string,
    customerId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ data?: TPayCheckoutSession; error?: Error }> {
    try {
      const priceId = this.config.priceIds[tier]
      if (!priceId) return { error: new Error(`No price configured for tier: ${tier}`) }

      const session = await this.#stripe.checkout.sessions.create({
        metadata: { tier },
        customer: customerId,
        mode: `subscription`,
        cancel_url: cancelUrl,
        success_url: successUrl,
        line_items: [{ price: priceId, quantity: 1 }],
      })

      return {
        data: {
          id: session.id,
          url: session.url || ``,
          customer_id: customerId,
        },
      }
    } catch (err: unknown) {
      logger.error(`[StripeService] Failed to create checkout session:`, err)
      return { error: err as Error }
    }
  }

  /**
   * Create a Stripe Billing Portal session
   */
  async createPortalSession(
    customerId: string
  ): Promise<{ data?: TPayPortalSession; error?: Error }> {
    try {
      const session = await this.#stripe.billingPortal.sessions.create({
        customer: customerId,
      })
      return { data: { url: session.url } }
    } catch (err: unknown) {
      logger.error(`[StripeService] Failed to create portal session:`, err)
      return { error: err as Error }
    }
  }

  /**
   * Cancel a subscription at the end of the current billing period
   */
  async cancelSubscription(subscriptionId: string): Promise<void> {
    await this.#stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    })
  }

  /**
   * Update a subscription to a new price (proration-based upgrade/downgrade)
   */
  async updateSubscription(subscriptionId: string, newPriceId: string): Promise<void> {
    const sub = await this.#stripe.subscriptions.retrieve(subscriptionId)
    const currentItem = sub.items.data[0]
    if (!currentItem) throw new Error(`No subscription items found`)

    await this.#stripe.subscriptions.update(subscriptionId, {
      items: [{ id: currentItem.id, price: newPriceId }],
      proration_behavior: `create_prorations`,
    })
  }

  /**
   * Update the seat quantity for the seat line item on a subscription.
   * Finds the subscription item whose price matches a seat price ID.
   */
  async updateSeatQuantity(subscriptionId: string, quantity: number): Promise<void> {
    const sub = await this.#stripe.subscriptions.retrieve(subscriptionId)
    const seatPriceIdSet = new Set(Object.values(this.config.seatPriceIds))
    const seatItem = sub.items.data.find(
      (item) => typeof item.price === `object` && seatPriceIdSet.has(item.price.id)
    )

    if (!seatItem) {
      logger.warn(
        `[StripeService] No seat line item found on subscription ${subscriptionId}`
      )
      return
    }

    await this.#stripe.subscriptionItems.update(seatItem.id, { quantity })
  }

  /**
   * List invoices for a Stripe customer
   */
  async getInvoices(customerId: string): Promise<any[]> {
    const result = await this.#stripe.invoices.list({ customer: customerId, limit: 100 })
    return result.data
  }

  /**
   * Construct and verify a Stripe webhook event
   */
  constructWebhookEvent(payload: Buffer, signature: string): Stripe.Event {
    return this.#stripe.webhooks.constructEvent(
      payload,
      signature,
      this.config.webhookSecret
    )
  }

  /**
   * Handle verified Stripe webhook events
   */
  async webhook(app: TApp, event: Stripe.Event): Promise<void> {
    const db = app.locals.db

    switch (event.type) {
      case `checkout.session.completed`: {
        await this.#handleCheckoutCompleted(
          db,
          event.data.object as Stripe.Checkout.Session
        )
        break
      }
      case `customer.subscription.updated`: {
        await this.#handleSubscriptionUpdated(
          db,
          event.data.object as Stripe.Subscription
        )
        break
      }
      case `customer.subscription.deleted`: {
        await this.#handleSubscriptionDeleted(
          db,
          event.data.object as Stripe.Subscription
        )
        break
      }
      case `invoice.paid`: {
        await this.#handleInvoicePaid(db, event.data.object as Stripe.Invoice)
        break
      }
      case `invoice.payment_failed`: {
        await this.#handleInvoicePaymentFailed(db, event.data.object as Stripe.Invoice)
        break
      }
      default:
        logger.info(`[StripeService] Unhandled webhook event type: ${event.type}`)
    }
  }

  /**
   * Resolve an ESubscriptionTier from a Stripe price ID by checking priceIds map.
   * Logs an error if the priceId is not found in the configured price map.
   */
  #tierFromPriceId(priceId: string): ESubscriptionTier {
    const entry = Object.entries(this.config.priceIds).find(([, id]) => id === priceId)
    if (!entry) {
      logger.error(
        `[StripeService] Unknown priceId "${priceId}" not found in configured priceIds map, defaulting to free tier`
      )
      return ESubscriptionTier.free
    }
    return entry[0] as ESubscriptionTier
  }

  /**
   * Handle checkout.session.completed - new subscription created via Checkout
   */
  async #handleCheckoutCompleted(
    db: TApp[`locals`][`db`],
    session: Stripe.Checkout.Session
  ) {
    const subscriptionId =
      typeof session.subscription === `string`
        ? session.subscription
        : session.subscription?.id
    const customerId =
      typeof session.customer === `string` ? session.customer : session.customer?.id

    if (!subscriptionId || !customerId) {
      throw new Error(
        `[StripeService] checkout.session.completed missing subscription or customer ID`
      )
    }

    // Retrieve full subscription to get price and period info
    const sub = await this.#stripe.subscriptions.retrieve(subscriptionId)
    const priceId = sub.items.data[0]?.price?.id || ``
    const tier = session.metadata?.tier || this.#tierFromPriceId(priceId)

    // Find user by stripeCustomerId or metadata
    const { data: existingSub } =
      await db.services.subscription.findByStripeCustomerId(customerId)
    const userId = existingSub?.userId

    if (!userId) {
      throw new Error(
        `[StripeService] No user found for customer ${customerId} during checkout.session.completed`
      )
    }

    const item = sub.items.data[0]
    const { error } = await db.services.subscription.upsertByUser({
      userId,
      tier,
      status: sub.status,
      seats: 1,
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscriptionId,
      stripePriceId: priceId,
      currentPeriodStart: item?.current_period_start
        ? new Date(item.current_period_start * 1000).toISOString()
        : undefined,
      currentPeriodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : undefined,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    })

    if (error) {
      throw new Error(
        `[StripeService] Failed to upsert subscription for user ${userId}: ${error.message}`
      )
    }

    logger.info(`[StripeService] Subscription created for user ${userId}, tier: ${tier}`)
  }

  /**
   * Handle customer.subscription.updated - tier/status/period changes
   */
  async #handleSubscriptionUpdated(db: TApp[`locals`][`db`], sub: Stripe.Subscription) {
    const { data: existingSub } =
      await db.services.subscription.findByStripeSubscriptionId(sub.id)

    if (!existingSub) {
      throw new Error(
        `[StripeService] No local subscription found for stripe subscription ${sub.id}`
      )
    }

    const item = sub.items.data[0]
    const priceId = item?.price?.id || ``
    const tier = this.#tierFromPriceId(priceId)

    const { error } = await db.services.subscription.upsertByUser({
      userId: existingSub.userId,
      tier,
      status: sub.status,
      stripePriceId: priceId,
      stripeSubscriptionId: sub.id,
      currentPeriodStart: item?.current_period_start
        ? new Date(item.current_period_start * 1000).toISOString()
        : undefined,
      currentPeriodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : undefined,
      cancelAtPeriodEnd: sub.cancel_at_period_end,
    })

    if (error) {
      throw new Error(
        `[StripeService] Failed to update subscription ${sub.id}: ${error.message}`
      )
    }

    logger.info(`[StripeService] Subscription ${sub.id} updated, tier: ${tier}`)
  }

  /**
   * Handle customer.subscription.deleted - subscription fully cancelled
   */
  async #handleSubscriptionDeleted(db: TApp[`locals`][`db`], sub: Stripe.Subscription) {
    const { data: existingSub } =
      await db.services.subscription.findByStripeSubscriptionId(sub.id)

    if (!existingSub) {
      throw new Error(
        `[StripeService] No local subscription found for deleted stripe subscription ${sub.id}`
      )
    }

    const item = sub.items.data[0]
    const { error } = await db.services.subscription.upsertByUser({
      userId: existingSub.userId,
      tier: ESubscriptionTier.free,
      status: `canceled`,
      cancelAtPeriodEnd: false,
      stripeSubscriptionId: sub.id,
      currentPeriodEnd: item?.current_period_end
        ? new Date(item.current_period_end * 1000).toISOString()
        : undefined,
    })

    if (error) {
      throw new Error(
        `[StripeService] Failed to revert subscription ${sub.id} to free: ${error.message}`
      )
    }

    logger.info(`[StripeService] Subscription ${sub.id} deleted, reverted to free`)
  }

  /**
   * Handle invoice.paid - record invoice and optionally reset quotas on cycle.
   * When a new billing cycle begins, consumption-based counters (compute, threads, messages)
   * reset to 0 while stock-based counters (projects, endpoints, secrets) carry forward
   * from the previous period.
   */
  async #handleInvoicePaid(db: TApp[`locals`][`db`], invoice: Stripe.Invoice) {
    const customerId =
      typeof invoice.customer === `string` ? invoice.customer : invoice.customer?.id

    if (!customerId) {
      throw new Error(
        `[StripeService] invoice.paid missing customer ID for invoice ${invoice.id}`
      )
    }

    const { data: existingSub } =
      await db.services.subscription.findByStripeCustomerId(customerId)

    if (!existingSub) {
      throw new Error(
        `[StripeService] No subscription found for customer ${customerId} during invoice.paid`
      )
    }

    // Record the invoice
    const { error: invoiceErr } = await db.services.invoice.upsertByStripeId(invoice.id, {
      userId: existingSub.userId,
      amount: invoice.amount_paid || 0,
      currency: invoice.currency || `usd`,
      status: `paid`,
      invoiceUrl: invoice.hosted_invoice_url || undefined,
      period: getBillingPeriod(),
    })
    if (invoiceErr) {
      logger.error(`[StripeService] Failed to record invoice ${invoice.id}:`, invoiceErr)
    }

    // Only reset quotas when this is a recurring billing cycle (not first invoice)
    if (invoice.billing_reason === `subscription_cycle` && existingSub.userId) {
      // Find all orgs owned by this user and initialize fresh quota periods
      const { data: orgs } = await db.services.org.list({
        where: { ownerId: existingSub.userId },
      })
      const newPeriod = getBillingPeriod()
      // Compute the previous period to carry forward stock-based counters
      const now = new Date()
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1)
      const prevPeriod = `${prev.getFullYear()}-${String(prev.getMonth() + 1).padStart(2, '0')}`
      if (orgs?.length) {
        await Promise.all(
          orgs.map(async (org: any) => {
            // Fetch the previous period's usage to carry forward stock-based counters
            const { data: previousUsage } = await db.services.quota.getUsage(
              org.id,
              prevPeriod
            )
            const stockCounters = {
              projects: previousUsage?.projects ?? 0,
              endpoints: previousUsage?.endpoints ?? 0,
              secrets: previousUsage?.secrets ?? 0,
            }
            return db.services.quota.initializePeriod(org.id, newPeriod, stockCounters)
          })
        )
      }
    }

    logger.info(`[StripeService] Invoice ${invoice.id} paid`)
  }

  /**
   * Handle invoice.payment_failed - mark subscription as past_due
   */
  async #handleInvoicePaymentFailed(db: TApp[`locals`][`db`], invoice: Stripe.Invoice) {
    const customerId =
      typeof invoice.customer === `string` ? invoice.customer : invoice.customer?.id

    if (!customerId) {
      throw new Error(
        `[StripeService] invoice.payment_failed missing customer ID for invoice ${invoice.id}`
      )
    }

    const { data: existingSub } =
      await db.services.subscription.findByStripeCustomerId(customerId)

    if (!existingSub) {
      throw new Error(
        `[StripeService] No subscription found for customer ${customerId} during invoice.payment_failed`
      )
    }

    const { error } = await db.services.subscription.upsertByUser({
      userId: existingSub.userId,
      status: `past_due`,
    })

    if (error) {
      throw new Error(
        `[StripeService] Failed to mark subscription as past_due for customer ${customerId}: ${error.message}`
      )
    }

    // Record the failed invoice
    await db.services.invoice.upsertByStripeId(invoice.id, {
      userId: existingSub.userId,
      amount: invoice.amount_due || 0,
      currency: invoice.currency || `usd`,
      status: `failed`,
      invoiceUrl: invoice.hosted_invoice_url || undefined,
      period: getBillingPeriod(),
    })

    logger.error(`[StripeService] Invoice ${invoice.id} payment failed`)
  }
}

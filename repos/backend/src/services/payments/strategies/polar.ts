import type { TPayPlanMeta } from '@tdsk/domain'
import type {
  TApp,
  TPlanResp,
  TPayConfig,
  TPayProduct,
  TPayCustomer,
  TPayPortalSession,
  TPayCheckoutSession,
} from '@TBE/types'

import crypto from 'node:crypto'
import { Plan } from '@tdsk/domain'
import { Polar } from '@polar-sh/sdk'
import { API } from '@TBE/services/api'
import { logger } from '@TBE/utils/logger'
import { Exception } from '@tdsk/domain'
import { BaseService } from '@TBE/services/payments/strategies/base'

/**
 * Service for interacting with Polar.sh payment API
 */
export class PolarService extends BaseService {
  #api: API
  #token: string
  #service: Polar
  #wbhSecret: string
  #cache: Map<string, { data: TPayProduct; cachedAt: number }> = new Map()

  static readonly CACHE_TTL = 5 * 60 * 1000 // 5 minutes

  constructor(config: TPayConfig) {
    if (!config.token) throw new Exception(500, `Payments access token is required`)

    super(config)

    this.#token = config.token

    this.#service = new Polar({
      accessToken: this.#token,
      server: config.environment === `production` ? `production` : `sandbox`,
    })

    this.#wbhSecret = config.wbhSecret
    this.#api = new API({
      url: config.url,
      headers: {
        Authorization: `Bearer ${config.token}`,
        [`Content-Type`]: `application/json`,
      },
    })
  }

  /**
   * Fetch all configured payment plans from Polar API
   * Uses product IDs from config to fetch product details
   */
  async fetchPlans(): Promise<TPlanResp> {
    try {
      const productIds = Object.values(this.plans).filter((id) => id && !id.includes(`=`))
      if (productIds.length === 0)
        return {
          error: new Exception(404, `No product IDs configured in TDSK_PAY_PLANS`),
        }

      const plans: Plan[] = []
      const results = await Promise.all(
        productIds.map((productId) => this.fetchProduct(productId))
      )

      for (const [idx, result] of results.entries()) {
        if (result.error || !result.data) {
          logger.error(`Failed to fetch product ${productIds[idx]}:`, result?.error)
          continue
        }

        plans.push(this.#toPlan(result.data))
      }

      return { data: plans }
    } catch (err: unknown) {
      logger.error(`Failed to fetch plans:`, err)
      return { error: new Exception(500, (err as Error).message) }
    }
  }

  /**
   * Fetch a single product by ID from Polar API
   */
  async fetchProduct(
    productId: string
  ): Promise<{ data?: TPayProduct; error?: Exception }> {
    const cached = this.#cache.get(productId)
    if (cached && Date.now() - cached.cachedAt < PolarService.CACHE_TTL) {
      return { data: cached.data }
    }

    const resp = await this.#api.get<TPayProduct>({
      path: `/products/${productId}`,
    })

    if (resp?.data) this.#cache.set(productId, { data: resp.data, cachedAt: Date.now() })
    return resp
  }

  /**
   * Get plan limits for a given product ID
   * This fetches the product and returns its metadata as TPayPlanMeta
   */
  async getPlanLimits(
    productId: string
  ): Promise<{ data?: TPayPlanMeta; error?: Exception }> {
    const resp = await this.fetchProduct(productId)

    if (resp.error) return { error: resp.error }

    if (!resp.data) return { error: new Exception(404, `Product not found`) }

    return { data: this.#toPlan(resp.data).metadata }
  }

  /**
   * Get or create a customer in Polar
   */
  async ensureCustomer(
    email: string,
    userId: string
  ): Promise<{ data?: TPayCustomer; error?: Exception }> {
    const resp = await this.#api.get<{ data: TPayCustomer[] }>({
      data: { email },
      path: `/customers`,
    })
    if (resp?.error) return { error: resp.error }

    // Polar API returns { data: [customers] }, so unwrap the array
    const customers = resp?.data?.data || []
    if (customers.length) return { data: customers[0] }

    return await this.#api.post<TPayCustomer>({
      path: `/customers`,
      data: {
        email,
        metadata: {
          userId,
        },
      },
    })
  }

  /**
   * Create a checkout session for a subscription
   */
  async createCheckout(
    priceId: string,
    customerId: string,
    userId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ data?: TPayCheckoutSession; error?: Exception }> {
    return await this.#api.post<TPayCheckoutSession>({
      path: `/checkout/sessions`,
      data: {
        price_id: priceId,
        metadata: { userId },
        cancel_url: cancelUrl,
        customer_id: customerId,
        success_url: successUrl,
      },
    })
  }

  /**
   * Create a customer portal session for managing subscription
   */
  async createPortal(
    customerId: string
  ): Promise<{ data?: TPayPortalSession; error?: Error }> {
    return await this.#api.post<TPayPortalSession>({
      data: { customer_id: customerId },
      path: `/portal/sessions`,
    })
  }

  #toPlan(product: TPayProduct): Plan {
    return new Plan({
      id: product.id,
      name: product.name,
      metadata: product.metadata,
      description: product.description,
      recurring: {
        active: product.is_recurring,
        interval: product.recurring_interval,
        count: product.recurring_interval_count,
      },
    })
  }

  /**
   * Validate webhook signature from Polar
   * Uses timing-safe comparison and rejects stale timestamps
   */
  validateWebhook(payload: string, signature: string, timestamp: string): boolean {
    try {
      if (!timestamp || !signature) return false

      // Reject stale webhooks (older than 5 minutes)
      const ts = Number.parseInt(timestamp, 10)
      if (isNaN(ts)) return false
      const age = Math.abs(Date.now() / 1000 - ts)
      if (age > 300) return false

      // Polar uses a simple HMAC-SHA256 signature
      const signedPayload = `${timestamp}.${payload}`
      const expectedSignature = crypto
        .createHmac(`sha256`, this.#wbhSecret)
        .update(signedPayload)
        .digest(`hex`)

      const sigBuf = Buffer.from(signature, `utf8`)
      const expectedBuf = Buffer.from(expectedSignature, `utf8`)

      if (sigBuf.length !== expectedBuf.length) return false
      return crypto.timingSafeEqual(sigBuf, expectedBuf)
    } catch (err: unknown) {
      logger.error(`Failed to validate webhook signature:`, err)
      return false
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string
  ): Promise<{ data?: { success: boolean }; error?: Error }> {
    const resp = await this.#api.post({
      path: `/subscriptions/${subscriptionId}/cancel`,
    })

    return resp.error ? { error: resp.error } : { data: { success: true } }
  }

  /**
   * Webhook handler for Polar.sh subscription events
   */
  async webhook(app: TApp, payload: any) {
    const db = app.locals.db
    const payments = app.locals.payments

    if (!db) {
      logger.error(`Database not initialized in app.locals`)
      return { error: new Error(`Database not initialized`) }
    }

    try {
      const sub = payload.data
      const userId = sub?.metadata?.userId

      switch (payload.type) {
        case `subscription.created`:
        case `subscription.updated`: {
          if (!userId) {
            logger.warn(
              `Received subscription event without userId in metadata: ${sub.id}`
            )
            return { error: new Error(`Missing userId in metadata`) }
          }

          const tier = payments.service.getTierForProductId(sub.product_id) || `free`

          const result = await db.services.subscription.upsertByUser({
            tier,
            userId,
            polarId: sub.id,
            status: sub.status,
            polarPriceId: sub.price_id,
            polarCustomerId: sub.customer_id,
            currentPeriodEnd: sub.current_period_end,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            currentPeriodStart: sub.current_period_start,
          })

          if (result.error) {
            logger.error(`Failed to upsert subscription:`, result.error)
            return { error: result.error }
          }

          logger.info(`Subscription ${sub.id} ${payload.type} for user ${userId}`)
          return { data: result.data }
        }

        case `subscription.cancelled`: {
          if (!userId) {
            logger.warn(`Received subscription cancelled event without userId: ${sub.id}`)
            return { error: new Error(`Missing userId in metadata`) }
          }

          const result = await db.services.subscription.upsertByUser({
            userId,
            polarId: sub.id,
            status: `cancelled`,
            cancelAtPeriodEnd: true,
            currentPeriodEnd: sub.current_period_end,
          })

          if (result.error) {
            logger.error(`Failed to cancel subscription:`, result.error)
            return { error: result.error }
          }

          logger.info(`Subscription ${sub.id} cancelled for user ${userId}`)
          return { data: result.data }
        }

        default:
          logger.warn(`Unhandled webhook event type: ${payload.type}`)
          return { error: new Error(`Unhandled event type: ${payload.type}`) }
      }
    } catch (err: unknown) {
      logger.error(`Error processing Polar webhook:`, err)
      return { error: err as Error }
    }
  }
}

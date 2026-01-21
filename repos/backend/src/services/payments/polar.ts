import type { TPayPlanMeta } from '@tdsk/domain'
import type {
  TApp,
  TPlanResp,
  TPolarConfig,
  TPolarProduct,
  TPolarCustomer,
  TPolarPortalSession,
  TPolarCheckoutSession,
} from '@TBE/types'

import crypto from 'node:crypto'
import { Plan } from '@tdsk/domain'
import { API } from '@TBE/services/api'
import { logger } from '@TBE/utils/logger'
import { Exception } from '@TBE/utils/errors/exception'

/**
 * Service for interacting with Polar.sh payment API
 */
export class PolarService {
  #api: API

  private token: string
  private baseUrl: string
  private wbhSecret: string
  private plans: Record<string, string>

  constructor(config: TPolarConfig) {
    if (!config.token) throw new Exception(500, `Polar access token is required`)

    this.baseUrl = config.url
    this.token = config.token
    this.plans = config.plans
    this.wbhSecret = config.wbhSecret

    this.#api = new API({
      url: config.url,
      headers: {
        Authorization: `Bearer ${this.token}`,
        [`Content-Type`]: `application/json`,
      },
    })
  }

  /**
   * Fetch all configured payment plans from Polar API
   * Uses product IDs from config to fetch product details
   */
  fetchPlans = async (): Promise<TPlanResp> => {
    try {
      const productIds = Object.values(this.plans).filter((id) => id && !id.includes(`=`))

      if (productIds.length === 0)
        return {
          error: new Exception(404, `No product IDs configured in TDSK_PAY_PLANS`),
        }

      const plans: Plan[] = []

      for (const productId of productIds) {
        const result = await this.fetchProduct(productId)

        if (result.error || !result.data) {
          logger.error(`Failed to fetch product ${productId}:`, result?.error)
          continue
        }

        // Find the tier name for this product ID
        const tierName =
          Object.entries(this.plans).find(([_, id]) => id === productId)?.[0] || productId

        plans.push(
          new Plan({
            name: tierName,
            id: result.data.id,
            metadata: result.data.metadata,
          })
        )
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
  fetchProduct = async (
    productId: string
  ): Promise<{ data?: TPolarProduct; error?: Exception }> => {
    return await this.#api.get<TPolarProduct>({
      path: `/products/${productId}`,
    })
  }

  /**
   * Get plan limits for a given product ID
   * This fetches the product and returns its metadata as TPayPlanMeta
   */
  getPlanLimits = async (
    productId: string
  ): Promise<{ data?: TPayPlanMeta; error?: Exception }> => {
    const resp = await this.fetchProduct(productId)

    if (resp.error) return { error: resp.error }

    if (!resp.data) {
      return { error: new Exception(404, `Product not found`) }
    }

    // Convert raw metadata to typed metadata
    const plan = new Plan({
      id: resp.data.id,
      name: resp.data.name,
      metadata: resp.data.metadata,
    })

    return { data: plan.metadata }
  }

  /**
   * Get or create a customer in Polar
   */
  getOrCreateCustomer = async (
    email: string,
    userId: string
  ): Promise<{ data?: TPolarCustomer; error?: Exception }> => {
    const resp = await this.#api.get<{ data: TPolarCustomer[] }>({
      data: { email },
      path: `/customers`,
    })
    if (resp.error) return { error: resp.error }

    // Polar API returns { data: [customers] }, so unwrap the array
    const customers = resp.data?.data || []
    if (customers.length > 0) return { data: customers[0] }

    return await this.#api.post<TPolarCustomer>({
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
  createCheckoutSession = async (
    priceId: string,
    customerId: string,
    userId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ data?: TPolarCheckoutSession; error?: Exception }> => {
    return await this.#api.post<TPolarCheckoutSession>({
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
  createCustomerPortalSession = async (
    customerId: string
  ): Promise<{ data?: TPolarPortalSession; error?: Error }> => {
    return await this.#api.post<TPolarPortalSession>({
      data: { customer_id: customerId },
      path: `/portal/sessions`,
    })
  }

  /**
   * Validate webhook signature from Polar
   */
  validateWebhookSignature = (
    payload: string,
    signature: string,
    timestamp: string
  ): boolean => {
    try {
      // Polar uses a simple HMAC-SHA256 signature
      const signedPayload = `${timestamp}.${payload}`
      const expectedSignature = crypto
        .createHmac(`sha256`, this.wbhSecret)
        .update(signedPayload)
        .digest(`hex`)

      return signature === expectedSignature
    } catch (err: unknown) {
      logger.error(`Failed to validate webhook signature:`, err)
      return false
    }
  }

  /**
   * Cancel a subscription
   */
  cancelSubscription = async (
    subscriptionId: string
  ): Promise<{ data?: { success: boolean }; error?: Error }> => {
    const resp = await this.#api.post({
      path: `/subscriptions/${subscriptionId}/cancel`,
    })

    return resp.error ? { error: resp.error } : { data: { success: true } }
  }

  /**
   * Webhook handler for Polar.sh subscription events
   */
  webhook = async (app: TApp, payload: any) => {
    const db = app.locals.db
    const payments = app.locals.payments

    if (!db) {
      logger.error(`Database not initialized in app.locals`)
      return { error: new Error(`Database not initialized`) }
    }

    try {
      switch (payload.type) {
        case `subscription.created`:
        case `subscription.updated`: {
          const sub = payload.data
          const metadata = sub.metadata || {}
          const userId = metadata.userId

          if (!userId) {
            logger.warn(
              `Received subscription event without userId in metadata: ${sub.id}`
            )
            return { error: new Error(`Missing userId in metadata`) }
          }

          // Determine tier from product ID
          const tier = payments.getTierForProductId(sub.product_id) || `free`

          const result = await db.services.subscription.upsert({
            tier: tier,
            userId: userId,
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
          const sub = payload.data
          const metadata = sub.metadata || {}
          const userId = metadata.userId

          if (!userId) {
            logger.warn(`Received subscription cancelled event without userId: ${sub.id}`)
            return { error: new Error(`Missing userId in metadata`) }
          }

          const result = await db.services.subscription.upsert({
            tier: `free`,
            userId: userId,
            polarId: sub.id,
            status: `cancelled`,
            cancelAtPeriodEnd: true,
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

  /**
   * Get the product ID for a given tier name
   */
  getProductIdForTier = (tier: string): string | undefined => {
    return this.plans[tier.toLowerCase()]
  }

  /**
   * Get the tier name for a given product ID
   */
  getTierForProductId = (productId: string): string | undefined => {
    return Object.entries(this.plans).find(([_, id]) => id === productId)?.[0]
  }
}

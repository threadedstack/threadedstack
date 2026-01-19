import type { Plan } from '@tdsk/domain'
import type { TPayPlanMeta, TPayPlanRaw } from '@tdsk/domain'
import { Plan as PlanModel } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'

export type TPolarConfig = {
  token: string
  url: string
  wbhSecret: string
  plans: Record<string, string>
}

export type TPolarProduct = {
  id: string
  name: string
  metadata: TPayPlanRaw
}

export type TPolarCustomer = {
  id: string
  email: string
  metadata?: Record<string, string>
}

export type TPolarCheckoutSession = {
  id: string
  url: string
  customer_id: string
}

export type TPolarPortalSession = {
  url: string
}

/**
 * Service for interacting with Polar.sh payment API
 */
export class PolarService {
  private token: string
  private baseUrl: string
  private wbhSecret: string
  private plans: Record<string, string>

  constructor(config: TPolarConfig) {
    this.baseUrl = config.url
    this.token = config.token
    this.plans = config.plans
    this.wbhSecret = config.wbhSecret

    if (!this.token) {
      throw new Error('Polar access token is required')
    }
  }

  /**
   * Fetch all configured payment plans from Polar API
   * Uses product IDs from config to fetch product details
   */
  async fetchPlans(): Promise<{ data?: Plan[]; error?: Error }> {
    try {
      const productIds = Object.values(this.plans).filter((id) => id && !id.includes('='))

      if (productIds.length === 0) {
        return {
          error: new Error('No product IDs configured in TDSK_PAY_PLANS'),
        }
      }

      const plans: Plan[] = []

      for (const productId of productIds) {
        const result = await this.fetchProduct(productId)

        if (result.error) {
          logger.error(`Failed to fetch product ${productId}:`, result.error)
          continue
        }

        if (result.data) {
          // Find the tier name for this product ID
          const tierName =
            Object.entries(this.plans).find(([_, id]) => id === productId)?.[0] ||
            productId

          plans.push(
            new PlanModel({
              id: result.data.id,
              name: tierName,
              metadata: result.data.metadata,
            })
          )
        }
      }

      return { data: plans }
    } catch (err: unknown) {
      logger.error('Failed to fetch plans:', err)
      return { error: err as Error }
    }
  }

  /**
   * Fetch a single product by ID from Polar API
   */
  async fetchProduct(
    productId: string
  ): Promise<{ data?: TPolarProduct; error?: Error }> {
    try {
      const response = await fetch(`${this.baseUrl}/products/${productId}`, {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          error: new Error(`Polar API error: ${response.status} ${errorText}`),
        }
      }

      const data = (await response.json()) as TPolarProduct
      return { data }
    } catch (err: unknown) {
      logger.error(`Failed to fetch product ${productId}:`, err)
      return { error: err as Error }
    }
  }

  /**
   * Get plan limits for a given product ID
   * This fetches the product and returns its metadata as TPayPlanMeta
   */
  async getPlanLimits(
    productId: string
  ): Promise<{ data?: TPayPlanMeta; error?: Error }> {
    try {
      const result = await this.fetchProduct(productId)

      if (result.error) {
        return { error: result.error }
      }

      if (!result.data) {
        return { error: new Error('Product not found') }
      }

      // Convert raw metadata to typed metadata
      const plan = new PlanModel({
        id: result.data.id,
        name: result.data.name,
        metadata: result.data.metadata,
      })

      return { data: plan.metadata }
    } catch (err: unknown) {
      logger.error(`Failed to get plan limits for ${productId}:`, err)
      return { error: err as Error }
    }
  }

  /**
   * Get or create a customer in Polar
   */
  async getOrCreateCustomer(
    email: string,
    userId: string
  ): Promise<{ data?: TPolarCustomer; error?: Error }> {
    try {
      // Try to find existing customer
      const findResponse = await fetch(
        `${this.baseUrl}/customers?email=${encodeURIComponent(email)}`,
        {
          method: 'GET',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (findResponse.ok) {
        const customers = (await findResponse.json()) as {
          data: TPolarCustomer[]
        }
        if (customers.data && customers.data.length > 0) {
          return { data: customers.data[0] }
        }
      }

      // Create new customer if not found
      const createResponse = await fetch(`${this.baseUrl}/customers`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email,
          metadata: {
            userId,
          },
        }),
      })

      if (!createResponse.ok) {
        const errorText = await createResponse.text()
        return {
          error: new Error(
            `Failed to create customer: ${createResponse.status} ${errorText}`
          ),
        }
      }

      const data = (await createResponse.json()) as TPolarCustomer
      return { data }
    } catch (err: unknown) {
      logger.error('Failed to get or create customer:', err)
      return { error: err as Error }
    }
  }

  /**
   * Create a checkout session for a subscription
   */
  async createCheckoutSession(
    priceId: string,
    customerId: string,
    userId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ data?: TPolarCheckoutSession; error?: Error }> {
    try {
      const response = await fetch(`${this.baseUrl}/checkout/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          price_id: priceId,
          customer_id: customerId,
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: {
            userId,
          },
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          error: new Error(
            `Failed to create checkout session: ${response.status} ${errorText}`
          ),
        }
      }

      const data = (await response.json()) as TPolarCheckoutSession
      return { data }
    } catch (err: unknown) {
      logger.error('Failed to create checkout session:', err)
      return { error: err as Error }
    }
  }

  /**
   * Create a customer portal session for managing subscription
   */
  async createCustomerPortalSession(
    customerId: string
  ): Promise<{ data?: TPolarPortalSession; error?: Error }> {
    try {
      const response = await fetch(`${this.baseUrl}/portal/sessions`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          customer_id: customerId,
        }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        return {
          error: new Error(
            `Failed to create portal session: ${response.status} ${errorText}`
          ),
        }
      }

      const data = (await response.json()) as TPolarPortalSession
      return { data }
    } catch (err: unknown) {
      logger.error('Failed to create portal session:', err)
      return { error: err as Error }
    }
  }

  /**
   * Validate webhook signature from Polar
   */
  validateWebhookSignature(
    payload: string,
    signature: string,
    timestamp: string
  ): boolean {
    try {
      // Polar uses a simple HMAC-SHA256 signature
      const crypto = require('node:crypto')
      const signedPayload = `${timestamp}.${payload}`
      const expectedSignature = crypto
        .createHmac('sha256', this.wbhSecret)
        .update(signedPayload)
        .digest('hex')

      return signature === expectedSignature
    } catch (err: unknown) {
      logger.error('Failed to validate webhook signature:', err)
      return false
    }
  }

  /**
   * Cancel a subscription
   */
  async cancelSubscription(
    subscriptionId: string
  ): Promise<{ data?: { success: boolean }; error?: Error }> {
    try {
      const response = await fetch(
        `${this.baseUrl}/subscriptions/${subscriptionId}/cancel`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${this.token}`,
            'Content-Type': 'application/json',
          },
        }
      )

      if (!response.ok) {
        const errorText = await response.text()
        return {
          error: new Error(
            `Failed to cancel subscription: ${response.status} ${errorText}`
          ),
        }
      }

      return { data: { success: true } }
    } catch (err: unknown) {
      logger.error('Failed to cancel subscription:', err)
      return { error: err as Error }
    }
  }

  /**
   * Get the product ID for a given tier name
   */
  getProductIdForTier(tier: string): string | undefined {
    return this.plans[tier.toLowerCase()]
  }

  /**
   * Get the tier name for a given product ID
   */
  getTierForProductId(productId: string): string | undefined {
    return Object.entries(this.plans).find(([_, id]) => id === productId)?.[0]
  }
}

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

import type { Exception } from '@tdsk/domain'

/**
 * Abstract base service for payment providers.
 * Subclasses must implement all abstract methods.
 */
export abstract class BaseService {
  plans: Record<string, string>

  constructor(config: TPayConfig) {
    this.plans = config.plans
  }

  /**
   * Fetch all configured payment plans from the payment provider
   * Uses product IDs from config to fetch product details
   */
  abstract fetchPlans(): Promise<TPlanResp>

  /**
   * Fetch a single product by ID from the payment provider
   */
  abstract fetchProduct(
    productId: string
  ): Promise<{ data?: TPayProduct; error?: Exception }>

  /**
   * Get plan limits for a given product ID
   * This fetches the product and returns its metadata as TPayPlanMeta
   */
  abstract getPlanLimits(
    productId: string
  ): Promise<{ data?: TPayPlanMeta; error?: Exception }>

  /**
   * Get or create a customer in the payment provider
   */
  abstract ensureCustomer(
    email: string,
    userId: string
  ): Promise<{ data?: TPayCustomer; error?: Exception }>

  /**
   * Create a checkout session for a subscription
   */
  abstract createCheckout(
    priceId: string,
    customerId: string,
    userId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ data?: TPayCheckoutSession; error?: Exception }>

  /**
   * Create a customer portal session for managing subscription
   */
  abstract createPortal(
    customerId: string
  ): Promise<{ data?: TPayPortalSession; error?: Error }>

  /**
   * Validate webhook signature from the payment provider
   */
  abstract validateWebhook(payload: string, signature: string, timestamp: string): boolean

  /**
   * Cancel a subscription
   */
  abstract cancelSubscription(
    subscriptionId: string
  ): Promise<{ data?: { success: boolean }; error?: Error }>

  /**
   * Webhook handler for subscription events
   */
  abstract webhook(app: TApp, payload: any): Promise<{ data?: any; error?: Error }>

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

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

import { Exception } from '@TBE/utils/errors/exception'
import { OverrideError } from '@TBE/utils/errors/override'

/**
 * Service for interacting with Polar.sh payment API
 */
export class BaseService {
  plans: Record<string, string>

  constructor(config: TPayConfig) {
    if (!config.token) throw new Exception(500, `Payments access token is required`)
    this.plans = config.plans
  }

  /**
   * Fetch all configured payment plans from Polar API
   * Uses product IDs from config to fetch product details
   */
  fetchPlans = async (): Promise<TPlanResp> => {
    throw new OverrideError(`fetchPlans`)
  }

  /**
   * Fetch a single product by ID from Polar API
   */
  fetchProduct = async (
    productId: string
  ): Promise<{ data?: TPayProduct; error?: Exception }> => {
    throw new OverrideError(`fetchProduct`)
  }

  /**
   * Get plan limits for a given product ID
   * This fetches the product and returns its metadata as TPayPlanMeta
   */
  getPlanLimits = async (
    productId: string
  ): Promise<{ data?: TPayPlanMeta; error?: Exception }> => {
    throw new OverrideError(`getPlanLimits`)
  }

  /**
   * Get or create a customer in Polar
   */

  ensureCustomer = async (
    email: string,
    userId: string
  ): Promise<{ data?: TPayCustomer; error?: Exception }> => {
    throw new OverrideError(`ensureCustomer`)
  }

  /**
   * Create a checkout session for a subscription
   */
  createCheckout = async (
    priceId: string,
    customerId: string,
    userId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ data?: TPayCheckoutSession; error?: Exception }> => {
    throw new OverrideError(`createCheckout`)
  }

  /**
   * Create a customer portal session for managing subscription
   */
  createPortal = async (
    customerId: string
  ): Promise<{ data?: TPayPortalSession; error?: Error }> => {
    throw new OverrideError(`createPortal`)
  }

  /**
   * Validate webhook signature from Polar
   */
  validateWebhook = (payload: string, signature: string, timestamp: string): boolean => {
    throw new OverrideError(`validateWebhook`)
  }

  /**
   * Cancel a subscription
   */
  cancelSubscription = async (
    subscriptionId: string
  ): Promise<{ data?: { success: boolean }; error?: Error }> => {
    throw new OverrideError(`cancelSubscription`)
  }

  /**
   * Webhook handler for Polar.sh subscription events
   */
  webhook = async (app: TApp, payload: any): Promise<{ data?: any; error?: Error }> => {
    throw new OverrideError(`webhook`)
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

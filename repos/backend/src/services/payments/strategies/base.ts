import type {
  TApp,
  TPlanResp,
  TStripeConfig,
  TPayCustomer,
  TPayPortalSession,
  TPayCheckoutSession,
} from '@TBE/types'

/**
 * Abstract base service for payment providers.
 * Subclasses must implement all abstract methods.
 */
export abstract class BaseService {
  config: TStripeConfig

  constructor(config: TStripeConfig) {
    this.config = config
  }

  /**
   * Fetch all configured payment plans (static from PlanLimits)
   */
  abstract fetchPlans(): TPlanResp

  /**
   * Create a customer in the payment provider
   */
  abstract createCustomer(
    email: string,
    userId: string
  ): Promise<{ data?: TPayCustomer; error?: Error }>

  /**
   * Create a checkout session for a subscription
   */
  abstract createCheckoutSession(
    tier: string,
    customerId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ data?: TPayCheckoutSession; error?: Error }>

  /**
   * Create a customer portal session for managing subscription
   */
  abstract createPortalSession(
    customerId: string
  ): Promise<{ data?: TPayPortalSession; error?: Error }>

  /**
   * Cancel a subscription (cancel at period end)
   */
  abstract cancelSubscription(subscriptionId: string): Promise<void>

  /**
   * Update a subscription to a new price
   */
  abstract updateSubscription(subscriptionId: string, newPriceId: string): Promise<void>

  /**
   * Update the seat quantity on a subscription
   */
  abstract updateSeatQuantity(subscriptionId: string, quantity: number): Promise<void>

  /**
   * Get invoices for a customer
   */
  abstract getInvoices(customerId: string): Promise<any[]>

  /**
   * Construct and verify a webhook event from raw payload and signature
   */
  abstract constructWebhookEvent(payload: Buffer, signature: string): any

  /**
   * Handle a verified webhook event
   */
  abstract webhook(app: TApp, event: any): Promise<void>
}

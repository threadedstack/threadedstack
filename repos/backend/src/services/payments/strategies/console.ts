import type {
  TApp,
  TPlanResp,
  TStripeConfig,
  TPayCustomer,
  TPayPortalSession,
  TPayCheckoutSession,
} from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { BaseService } from '@TBE/services/payments/strategies/base'
import type { ESubscriptionTier } from '@tdsk/domain'
import { Plan, PlanLimits, PlanPrices } from '@tdsk/domain'

/**
 * Console-based payment service stub for development mode.
 * Logs method calls and returns appropriate stub values.
 */
export class ConsoleService extends BaseService {
  constructor(config: TStripeConfig) {
    super(config)
    logger.info(`[ConsoleService] Initialized in dev mode (no payment provider)`)
  }

  fetchPlans(): TPlanResp {
    logger.info(`[ConsoleService] fetchPlans called (dev mode)`)
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

  async createCustomer(
    email: string,
    userId: string
  ): Promise<{ data?: TPayCustomer; error?: Error }> {
    logger.info(`[ConsoleService] createCustomer called for ${email} (dev mode)`)
    return {
      data: {
        id: `console_cust_${userId}`,
        email,
        metadata: { userId },
      },
    }
  }

  async createCheckoutSession(
    tier: string,
    customerId: string,
    successUrl: string,
    _cancelUrl: string
  ): Promise<{ data?: TPayCheckoutSession; error?: Error }> {
    logger.info(
      `[ConsoleService] createCheckoutSession called for tier ${tier} (dev mode)`
    )
    return {
      data: {
        id: `console_session_${Date.now()}`,
        url: successUrl,
        customer_id: customerId,
      },
    }
  }

  async createPortalSession(
    customerId: string
  ): Promise<{ data?: TPayPortalSession; error?: Error }> {
    logger.info(
      `[ConsoleService] createPortalSession called for ${customerId} (dev mode)`
    )
    return { data: { url: `/billing` } }
  }

  async cancelSubscription(subscriptionId: string): Promise<void> {
    logger.info(
      `[ConsoleService] cancelSubscription called for ${subscriptionId} (dev mode)`
    )
  }

  async updateSubscription(subscriptionId: string, newPriceId: string): Promise<void> {
    logger.info(
      `[ConsoleService] updateSubscription called for ${subscriptionId} → ${newPriceId} (dev mode)`
    )
  }

  async updateSeatQuantity(subscriptionId: string, quantity: number): Promise<void> {
    logger.info(
      `[ConsoleService] updateSeatQuantity called for ${subscriptionId}, qty=${quantity} (dev mode)`
    )
  }

  async getInvoices(customerId: string): Promise<any[]> {
    logger.info(`[ConsoleService] getInvoices called for ${customerId} (dev mode)`)
    return []
  }

  constructWebhookEvent(_payload: Buffer | string, _signature: string): any {
    // ConsoleService has no webhook secret — always reject webhook events
    // This ensures webhook security is maintained even in dev mode
    throw new Error(`Webhook signature verification unavailable in console mode`)
  }

  async webhook(_app: TApp, _event: any): Promise<void> {
    logger.info(`[ConsoleService] webhook called (dev mode)`)
  }
}

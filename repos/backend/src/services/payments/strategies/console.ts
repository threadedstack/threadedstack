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

import { logger } from '@TBE/utils/logger'
import { Exception } from '@tdsk/domain'
import { BaseService } from '@TBE/services/payments/strategies/base'

/**
 * Console-based payment service stub for development mode.
 * Logs method calls and returns appropriate empty/error values.
 */
export class ConsoleService extends BaseService {
  constructor(config: TPayConfig) {
    super(config)
    logger.info(`[ConsoleService] Initialized in dev mode (no payment provider)`)
  }

  async fetchPlans(): Promise<TPlanResp> {
    logger.info(`[ConsoleService] fetchPlans called (dev mode)`)
    return { data: [] }
  }

  async fetchProduct(
    productId: string
  ): Promise<{ data?: TPayProduct; error?: Exception }> {
    logger.info(`[ConsoleService] fetchProduct called for ${productId} (dev mode)`)
    return { error: new Exception(501, `Payment provider not configured (dev mode)`) }
  }

  async getPlanLimits(
    productId: string
  ): Promise<{ data?: TPayPlanMeta; error?: Exception }> {
    logger.info(`[ConsoleService] getPlanLimits called for ${productId} (dev mode)`)
    return { error: new Exception(501, `Payment provider not configured (dev mode)`) }
  }

  async ensureCustomer(
    email: string,
    userId: string
  ): Promise<{ data?: TPayCustomer; error?: Exception }> {
    logger.info(`[ConsoleService] ensureCustomer called for ${email} (dev mode)`)
    return { error: new Exception(501, `Payment provider not configured (dev mode)`) }
  }

  async createCheckout(
    priceId: string,
    customerId: string,
    userId: string,
    successUrl: string,
    cancelUrl: string
  ): Promise<{ data?: TPayCheckoutSession; error?: Exception }> {
    logger.info(`[ConsoleService] createCheckout called for ${priceId} (dev mode)`)
    return { error: new Exception(501, `Payment provider not configured (dev mode)`) }
  }

  async createPortal(
    customerId: string
  ): Promise<{ data?: TPayPortalSession; error?: Error }> {
    logger.info(`[ConsoleService] createPortal called for ${customerId} (dev mode)`)
    return { error: new Error(`Payment provider not configured (dev mode)`) }
  }

  validateWebhook(payload: string, signature: string, timestamp: string): boolean {
    logger.info(`[ConsoleService] validateWebhook called (dev mode)`)
    return false
  }

  async cancelSubscription(
    subscriptionId: string
  ): Promise<{ data?: { success: boolean }; error?: Error }> {
    logger.info(
      `[ConsoleService] cancelSubscription called for ${subscriptionId} (dev mode)`
    )
    return { error: new Error(`Payment provider not configured (dev mode)`) }
  }

  async webhook(app: TApp, payload: any): Promise<{ data?: any; error?: Error }> {
    logger.info(`[ConsoleService] webhook called with type ${payload?.type} (dev mode)`)
    return { error: new Error(`Payment provider not configured (dev mode)`) }
  }
}

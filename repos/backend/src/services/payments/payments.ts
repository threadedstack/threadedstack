import type { TStripeConfig } from '@TBE/types'

import { EPayType } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import type { BaseService } from '@TBE/services/payments/strategies/base'
import { StripeService } from '@TBE/services/payments/strategies/stripe'
import { ConsoleService } from '@TBE/services/payments/strategies/console'

/**
 * Payments Service
 *
 * Provider-agnostic payments service using the Strategy Pattern.
 * Switches between Stripe or Console logging based on configuration.
 *
 * Supported Providers:
 * - Stripe (via Stripe SDK)
 * - Console (development logging)
 */
export class PaymentsService {
  service: BaseService

  constructor(config: TStripeConfig) {
    this.service = this.setup(config)
  }

  setup = (config: TStripeConfig) => {
    switch (config.type) {
      case EPayType.stripe: {
        return new StripeService(config)
      }
      case EPayType.console:
      default: {
        // TODO: Disable until stripe is configured
        //if (process.env.NODE_ENV === `production`) {
        //  throw new Error(
        //    `[PaymentsService] Stripe configuration is required in production. ` +
        //      `Set payments.type to "stripe" and provide a valid secret key.`
        //  )
        //}

        logger.warn(
          `[PaymentsService] No Stripe config provided — falling back to ConsoleService. ` +
            `Payment operations will be logged but not processed.`
        )

        return new ConsoleService(config)
      }
    }
  }
}

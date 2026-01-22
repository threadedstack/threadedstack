import type { TPayConfig } from '@TBE/types'

import { EPayType } from '@TBE/types'
import type { BaseService } from '@TBE/services/payments/strategies/base'
import { PolarService } from '@TBE/services/payments/strategies/polar'
import { ConsoleService } from '@TBE/services/payments/strategies/console'

/**
 * Accept backend config, and setup the payment service provider
 * Service provider based on the type (i.e. polar)
 */
/**
 * Payments Service
 *
 * Provider-agnostic payments service using the Strategy Pattern.
 * Switches between Polar, or Console logging based on configuration.
 *
 * Supported Providers:
 * - Polar (via REST API)
 * - Console (development logging)
 */
export class PaymentsService {
  service: BaseService

  constructor(config: TPayConfig) {
    this.service = this.setup(config)
  }

  setup = (config: TPayConfig) => {
    switch (config.type) {
      case EPayType.polar: {
        return new PolarService(config)
      }
      case EPayType.console:
      default: {
        return new ConsoleService(config)
      }
    }
  }
}

import type { TPayConfig } from '@TBE/types'

import { describe, it, expect, vi, afterEach } from 'vitest'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

// Mock the stripe SDK so constructing a StripeService never touches the network
vi.mock(`stripe`, () => ({
  default: vi.fn().mockImplementation(() => ({})),
}))

import { logger } from '@TBE/utils/logger'
import { EPayType } from '@TBE/types'
import { PaymentsService } from '@TBE/services/payments/payments'
import { StripeService } from '@TBE/services/payments/strategies/stripe'
import { ConsoleService } from '@TBE/services/payments/strategies/console'

const baseConfig: TPayConfig = {
  secretKey: `sk_test_123`,
  webhookSecret: `whsec_test_123`,
  priceIds: { solo: `price_solo`, pro: `price_pro`, team: `price_team` },
  seatPriceIds: { pro: `seat_pro`, team: `seat_team` },
}

describe(`PaymentsService`, () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    if (originalNodeEnv === undefined) delete process.env.NODE_ENV
    else process.env.NODE_ENV = originalNodeEnv
    vi.clearAllMocks()
  })

  describe(`setup`, () => {
    it(`selects StripeService when config.type is stripe`, () => {
      const payments = new PaymentsService({ ...baseConfig, type: EPayType.stripe })
      expect(payments.service).toBeInstanceOf(StripeService)
    })

    it(`selects ConsoleService when config.type is console outside production`, () => {
      process.env.NODE_ENV = `test`
      const payments = new PaymentsService({ ...baseConfig, type: EPayType.console })
      expect(payments.service).toBeInstanceOf(ConsoleService)
      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(`falling back to ConsoleService`)
      )
    })

    it(`falls back to ConsoleService when config.type is unset outside production`, () => {
      process.env.NODE_ENV = `local`
      const payments = new PaymentsService({ ...baseConfig, type: undefined })
      expect(payments.service).toBeInstanceOf(ConsoleService)
      expect(logger.warn).toHaveBeenCalled()
    })

    it(`falls back to ConsoleService for an unrecognized type outside production`, () => {
      process.env.NODE_ENV = `test`
      const payments = new PaymentsService({
        ...baseConfig,
        type: `unknown` as EPayType,
      })
      expect(payments.service).toBeInstanceOf(ConsoleService)
    })

    it(`throws in production when config.type is console`, () => {
      process.env.NODE_ENV = `production`
      expect(
        () => new PaymentsService({ ...baseConfig, type: EPayType.console })
      ).toThrow(`Stripe configuration is required in production`)
    })

    it(`throws in production when config.type is unset`, () => {
      process.env.NODE_ENV = `production`
      expect(() => new PaymentsService({ ...baseConfig, type: undefined })).toThrow(
        `Stripe configuration is required in production`
      )
    })

    it(`does not throw in production when config.type is stripe`, () => {
      process.env.NODE_ENV = `production`
      const payments = new PaymentsService({ ...baseConfig, type: EPayType.stripe })
      expect(payments.service).toBeInstanceOf(StripeService)
      expect(logger.warn).not.toHaveBeenCalled()
    })
  })
})

import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { PolarService } from '@TBE/services/payments'
import { config } from '@TBE/configs/backend.config'

/**
 * POST /subscriptions/checkout - Create a checkout session
 * Body: { tier: string, successUrl: string, cancelUrl: string }
 */
export const createCheckout: TEndpointConfig = {
  path: `/checkout`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id
    const userEmail = req.user?.email

    if (!userId || !userEmail) {
      res.status(401).json({ error: `Authentication required` })
      return
    }

    const { tier, successUrl, cancelUrl } = req.body

    if (!tier || !successUrl || !cancelUrl) {
      res.status(400).json({
        error: `Missing required fields: tier, successUrl, cancelUrl`,
      })
      return
    }

    const polarService = new PolarService(config.payments)

    // Get product ID for tier
    const productId = polarService.getProductIdForTier(tier)
    if (!productId) {
      res.status(400).json({ error: `Invalid tier: ${tier}` })
      return
    }

    // Get product to find price ID
    const productResult = await polarService.fetchProduct(productId)
    if (productResult.error || !productResult.data) {
      res.status(500).json({
        error: productResult.error?.message || 'Failed to fetch product',
      })
      return
    }

    // Create or get customer
    const customerResult = await polarService.getOrCreateCustomer(userEmail, userId)
    if (customerResult.error || !customerResult.data) {
      res.status(500).json({
        error: customerResult.error?.message || 'Failed to create customer',
      })
      return
    }

    // Create checkout session
    // Note: This assumes product has a price_id field - adjust based on actual Polar API
    const priceId = productResult.data.id // Using product ID as price ID for now
    const checkoutResult = await polarService.createCheckoutSession(
      priceId,
      customerResult.data.id,
      userId,
      successUrl,
      cancelUrl
    )

    if (checkoutResult.error || !checkoutResult.data) {
      res.status(500).json({
        error: checkoutResult.error?.message || 'Failed to create checkout session',
      })
      return
    }

    res.status(200).json({ data: checkoutResult.data })
  },
}

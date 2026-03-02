import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'

/**
 * POST /subscriptions/checkout - Create a checkout session
 * Body: { tier: string, successUrl: string, cancelUrl: string }
 */
export const createCheckout: TEndpointConfig = {
  path: `/checkout`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { payments } = req.app.locals
    const userId = req.user?.id
    const userEmail = req.user?.email

    if (!userId || !userEmail) throw new Exception(401, `Authentication required`)

    const { tier, successUrl, cancelUrl } = req.body

    if (!tier || !successUrl || !cancelUrl)
      throw new Exception(400, `Missing required fields: tier, successUrl, cancelUrl`)

    // Get product ID for tier
    const productId = payments.service.getProductIdForTier(tier)
    if (!productId) throw new Exception(400, `Invalid tier: ${tier}`)

    // Get product to find price ID
    const productResult = await payments.service.fetchProduct(productId)
    if (productResult.error || !productResult.data)
      throw new Exception(500, productResult.error?.message || `Failed to fetch product`)

    // Create or get customer
    const customerResult = await payments.service.ensureCustomer(userEmail, userId)
    if (customerResult.error || !customerResult.data)
      throw new Exception(
        500,
        customerResult.error?.message || `Failed to create customer`
      )

    // Create checkout session
    // Extract the actual price ID from the product's prices
    const prices = (productResult.data as any).prices
    const priceId = prices?.[0]?.id || productResult.data.id
    const checkoutResult = await payments.service.createCheckout(
      priceId,
      customerResult.data.id,
      userId,
      successUrl,
      cancelUrl
    )

    if (checkoutResult.error || !checkoutResult.data)
      throw new Exception(
        500,
        checkoutResult.error?.message || `Failed to create checkout session`
      )

    res.status(200).json({ data: checkoutResult.data })
  },
}

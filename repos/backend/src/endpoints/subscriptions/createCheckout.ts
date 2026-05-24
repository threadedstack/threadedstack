import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { Exception, ESubscriptionTier } from '@tdsk/domain'

const validTiers = new Set(Object.values(ESubscriptionTier).map((t) => t.toLowerCase()))

/**
 * POST /subscriptions/checkout - Create a checkout session
 * Body: { tier: string, successUrl: string, cancelUrl: string }
 *
 * If the user already has an active subscription at a different tier,
 * performs an upgrade/downgrade via updateSubscription instead.
 */
export const createCheckout: TEndpointConfig = {
  path: `/checkout`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, payments } = req.app.locals
    const userId = req.user?.id
    const userEmail = req.user?.email

    if (!userId || !userEmail) throw new Exception(401, `Authentication required`)

    const { successUrl, cancelUrl } = req.body
    const tier: ESubscriptionTier = req.body.tier?.toLowerCase()

    if (!tier || !successUrl || !cancelUrl)
      throw new Exception(400, `Missing required fields: tier, successUrl, cancelUrl`)

    if (!validTiers.has(tier as ESubscriptionTier))
      throw new Exception(400, `Invalid tier: ${tier}`)

    // Check if user already has an active subscription
    const subResult = await db.services.subscription.findByUser(userId)

    if (subResult.data?.stripeSubscriptionId && subResult.data.status === `active`) {
      if (tier === ESubscriptionTier.free) {
        await payments.service.cancelSubscription(subResult.data.stripeSubscriptionId)

        const { error: updateErr } = await db.services.subscription.upsertByUser({
          userId,
          cancelAtPeriodEnd: true,
        })
        if (updateErr) {
          logger.error(
            `[createCheckout] Stripe cancelled but local update failed for user ${userId}:`,
            updateErr
          )
        }

        res.status(200).json({
          data: {
            cancelled: true,
            message: `Subscription will be cancelled at period end`,
          },
        })
        return
      }

      const priceId = payments.service.config.priceIds[tier]
      if (!priceId) throw new Exception(400, `No price configured for tier: ${tier}`)

      await payments.service.updateSubscription(
        subResult.data.stripeSubscriptionId,
        priceId
      )

      res.status(200).json({
        data: { updated: true, message: `Subscription updated to ${tier}` },
      })
      return
    }

    if (tier === ESubscriptionTier.free)
      throw new Exception(400, `Cannot checkout for free tier`)

    // New subscription — create or retrieve customer, then create checkout session
    let customerId = subResult.data?.stripeCustomerId

    if (!customerId) {
      const customerResult = await payments.service.createCustomer(userEmail, userId)
      if (customerResult.error || !customerResult.data)
        throw new Exception(
          500,
          customerResult.error?.message || `Failed to create customer`
        )

      customerId = customerResult.data.id

      // Persist the customer ID on the subscription record
      await db.services.subscription.upsertByUser({
        userId,
        stripeCustomerId: customerId,
      })
    }

    const checkoutResult = await payments.service.createCheckoutSession(
      tier,
      customerId,
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

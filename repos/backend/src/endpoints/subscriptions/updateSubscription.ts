import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { Exception, ESubscriptionTier } from '@tdsk/domain'

const validTiers = new Set(Object.values(ESubscriptionTier))

/**
 * POST /subscriptions/update - Update current subscription tier
 * Body: { tier: string }
 *
 * Resolves the Stripe price ID for the target tier and updates the subscription.
 */
export const updateSubscription: TEndpointConfig = {
  path: `/update`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, payments } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { tier } = req.body
    if (!tier) throw new Exception(400, `Missing required field: tier`)

    if (!validTiers.has(tier as ESubscriptionTier))
      throw new Exception(400, `Invalid tier: ${tier}`)

    // Get user's subscription
    const subResult = await db.services.subscription.findByUser(userId)
    if (subResult.error) throw new Exception(500, subResult.error.message)

    if (!subResult.data?.stripeSubscriptionId)
      throw new Exception(404, `No active subscription found`)

    if (tier === ESubscriptionTier.free) {
      await payments.service.cancelSubscription(subResult.data.stripeSubscriptionId)

      const { error: updateErr } = await db.services.subscription.upsertByUser({
        userId,
        cancelAtPeriodEnd: true,
      })
      if (updateErr) {
        logger.error(
          `[updateSubscription] Stripe cancelled but local update failed for user ${userId}:`,
          updateErr
        )
      }

      res.status(200).json({
        data: { success: true, message: `Subscription will be cancelled at period end` },
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
      data: { success: true, message: `Subscription updated to ${tier}` },
    })
  },
}

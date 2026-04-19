import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /subscriptions/current - Cancel current subscription
 * Cancels at period end via Stripe, then updates local record.
 */
export const cancelSubscription: TEndpointConfig = {
  path: `/current`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.subscription)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, payments } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    // Get user's subscription
    const subResult = await db.services.subscription.findByUser(userId)
    if (subResult.error) throw new Exception(500, subResult.error.message)

    if (!subResult.data?.stripeSubscriptionId)
      throw new Exception(404, `No active subscription found`)

    await payments.service.cancelSubscription(subResult.data.stripeSubscriptionId)

    // Optimistically update local state to reflect cancellation at period end
    const { error: updateErr } = await db.services.subscription.upsertByUser({
      userId,
      cancelAtPeriodEnd: true,
    })
    if (updateErr) {
      logger.error(
        `[cancelSubscription] Stripe cancelled but local update failed for user ${userId}:`,
        updateErr
      )
    }

    res.status(200).json({
      data: { success: true, message: `Subscription cancelled successfully` },
    })
  },
}

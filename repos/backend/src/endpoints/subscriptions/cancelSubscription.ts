import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'

/**
 * DELETE /subscriptions/current - Cancel current subscription
 */
export const cancelSubscription: TEndpointConfig = {
  path: `/current`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, payments } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    // Get user's subscription
    const subResult = await db.services.subscription.findByUser(userId)
    if (subResult.error) throw new Exception(500, subResult.error.message)

    if (!subResult.data?.polarId) throw new Exception(404, `No active subscription found`)

    const cancelResult = await payments.service.cancelSubscription(subResult.data.polarId)

    if (cancelResult.error)
      throw new Exception(
        500,
        cancelResult.error.message || `Failed to cancel subscription`
      )

    res.status(200).json({
      data: { success: true, message: `Subscription cancelled successfully` },
    })
  },
}

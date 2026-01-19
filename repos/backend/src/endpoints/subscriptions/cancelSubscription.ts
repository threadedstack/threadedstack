import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { PolarService } from '@TBE/services/payments'
import { config } from '@TBE/configs/backend.config'

/**
 * DELETE /subscriptions/current - Cancel current subscription
 */
export const cancelSubscription: TEndpointConfig = {
  path: `/current`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) {
      res.status(401).json({ error: `Authentication required` })
      return
    }

    // Get user's subscription
    const subResult = await db.services.subscription.findByUser(userId)
    if (subResult.error) {
      res.status(500).json({ error: subResult.error.message })
      return
    }

    if (!subResult.data || !subResult.data.polarId) {
      res.status(404).json({
        error: `No active subscription found`,
      })
      return
    }

    const polarService = new PolarService(config.payments)
    const cancelResult = await polarService.cancelSubscription(subResult.data.polarId)

    if (cancelResult.error) {
      res.status(500).json({
        error: cancelResult.error.message || 'Failed to cancel subscription',
      })
      return
    }

    res.status(200).json({
      data: { message: 'Subscription cancelled successfully' },
    })
  },
}

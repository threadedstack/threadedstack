import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'

/**
 * GET /subscriptions/current - Get current user's subscription
 */
export const getCurrentSubscription: TEndpointConfig = {
  path: `/current`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) {
      res.status(401).json({ error: `Authentication required` })
      return
    }

    const { data, error } = await db.services.subscription.findByUser(userId)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!data) {
      // No subscription found - user is on free tier
      res.status(200).json({
        data: {
          userId,
          tier: 'free',
          status: 'active',
        },
      })
      return
    }

    res.status(200).json({ data })
  },
}

import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'

/**
 * GET /subscriptions/current - Get current user's subscription
 */
export const getCurrentSubscription: TEndpointConfig = {
  path: `/current`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { data, error } = await db.services.subscription.findByUser(userId)
    if (error) throw new Exception(500, error.message)

    data
      ? res.status(200).json({ data })
      : res.status(200).json({
          data: {
            userId,
            tier: `free`,
            status: `active`,
          },
        })
  },
}

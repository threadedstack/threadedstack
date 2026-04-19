import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /subscriptions/current - Get current user's subscription
 */
export const getCurrentSubscription: TEndpointConfig = {
  path: `/current`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.subscription)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { data, error } = await db.services.subscription.findByUser(userId)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({
      data: data ?? { userId, tier: `free`, status: `active` },
    })
  },
}

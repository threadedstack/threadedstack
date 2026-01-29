import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'

/**
 * POST /subscriptions/portal - Create a customer portal session
 */
export const createPortalSession: TEndpointConfig = {
  path: `/portal`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, payments } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    // Get user's subscription to find customer ID
    const subResult = await db.services.subscription.findByUser(userId)
    if (subResult.error) throw new Exception(500, subResult.error.message)

    if (!subResult.data || !subResult.data.polarCustomerId)
      throw new Exception(404, `No active subscription found`)

    const portalResult = await payments.service.createPortal(
      subResult.data.polarCustomerId
    )

    if (portalResult.error || !portalResult.data)
      throw new Exception(
        500,
        portalResult.error?.message || `Failed to create portal session`
      )

    res.status(200).json({ data: portalResult.data })
  },
}

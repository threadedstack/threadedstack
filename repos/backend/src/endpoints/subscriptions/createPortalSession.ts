import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { PolarService } from '@TBE/services/payments'
import { config } from '@TBE/configs/backend.config'

/**
 * POST /subscriptions/portal - Create a customer portal session
 */
export const createPortalSession: TEndpointConfig = {
  path: `/portal`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) {
      res.status(401).json({ error: `Authentication required` })
      return
    }

    // Get user's subscription to find customer ID
    const subResult = await db.services.subscription.findByUser(userId)
    if (subResult.error) {
      res.status(500).json({ error: subResult.error.message })
      return
    }

    if (!subResult.data || !subResult.data.polarCustomerId) {
      res.status(404).json({
        error: `No active subscription found`,
      })
      return
    }

    const polarService = new PolarService(config.payments)
    const portalResult = await polarService.createCustomerPortalSession(
      subResult.data.polarCustomerId
    )

    if (portalResult.error || !portalResult.data) {
      res.status(500).json({
        error: portalResult.error?.message || 'Failed to create portal session',
      })
      return
    }

    res.status(200).json({ data: portalResult.data })
  },
}

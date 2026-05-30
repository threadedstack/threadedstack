import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'

/**
 * GET /subscriptions/plans - Get all available payment plans
 * Fetches prices from the payment provider (Stripe) and combines with plan limits.
 */
export const getPlans: TEndpointConfig = {
  path: `/plans`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { payments } = req.app.locals

    const { data, error } = await payments.service.fetchPlans()
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}

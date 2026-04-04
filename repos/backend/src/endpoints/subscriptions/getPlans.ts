import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'

/**
 * GET /subscriptions/plans - Get all available payment plans
 * Returns static plan definitions derived from PlanLimits.
 */
export const getPlans: TEndpointConfig = {
  path: `/plans`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { payments } = req.app.locals

    const { data, error } = payments.service.fetchPlans()
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}

import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { PolarService } from '@TBE/services/payments'
import { config } from '@TBE/configs/backend.config'

/**
 * GET /subscriptions/plans - Get all available payment plans
 */
export const getPlans: TEndpointConfig = {
  path: `/plans`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const polarService = new PolarService(config.payments)
    const { data, error } = await polarService.fetchPlans()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

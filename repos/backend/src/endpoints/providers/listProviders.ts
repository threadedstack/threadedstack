import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'

/**
 * GET /Providers - List all Providers
 */
export const listProviders: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    // TODO: check user permissions
    // TODO: add code to list providers by org or project

    res.status(200).json({ data: [] })
  },
}

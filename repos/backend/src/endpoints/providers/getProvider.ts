import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'

/**
 * GET /Providers/:id - Get Provider by ID
 */
export const getProvider: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    // TODO: check user permissions
    // TODO: add code to get a provider by org or project
    const { id } = req.params
    const { db } = req.app.locals
    const { data, error } = await db.services.provider.get(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!data) {
      res.status(404).json({ error: `Provider not found` })
      return
    }

    res.status(200).json({ data })
  },
}

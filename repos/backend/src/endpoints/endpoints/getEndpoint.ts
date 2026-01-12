import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'

/**
 * GET /endpoints/:id - Get endpoint by ID
 */
export const getEndpoint: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { data, error } = await db.services.endpoint.get(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!data) {
      res.status(404).json({ error: `Endpoint not found` })
      return
    }

    res.status(200).json({ data })
  },
}

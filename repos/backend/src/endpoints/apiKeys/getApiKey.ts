import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'

/**
 * GET /api-keys/:id - Get API key by ID (metadata only)
 */
export const getApiKey: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { data, error } = await db.services.apiKey.get(id)

    error
      ? res.status(500).json({ error: error.message })
      : !data
        ? res.status(404).json({ error: `API key not found` })
        : res.status(200).json({ data: data.sanitize() })
  },
}

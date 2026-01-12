import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'

/**
 * DELETE /endpoints/:id - Delete an endpoint
 */
export const deleteEndpoint: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const { data: existing, error: getError } = await db.services.endpoint.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existing) {
      res.status(404).json({ error: `Endpoint not found` })
      return
    }

    const { data, error } = await db.services.endpoint.delete(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data: { success: true, id } })
  },
}

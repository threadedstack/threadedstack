import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'

/**
 * GET /endpoints - List all endpoints
 */
export const listEndpoints: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId } = req.query

    const { data, error } = await db.services.endpoint.list()

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    let eps = data || []
    if (projectId) eps = eps.filter((e: any) => e.projectId === projectId)

    res.status(200).json({ data: eps })
  },
}

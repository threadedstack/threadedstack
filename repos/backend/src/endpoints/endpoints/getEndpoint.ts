import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

/**
 * GET /endpoints/:id - Get endpoint by ID
 * Requires member+ role in project's org
 */
export const getEndpoint: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const data = await requireResourceWithPermission(
      req,
      db.services.endpoint,
      id,
      EPermAction.read,
      EPermResource.endpoint,
      `Endpoint`
    )

    res.status(200).json({ data })
  },
}

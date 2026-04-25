import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResource } from '@TBE/utils/auth/requireResource'

/**
 * GET /endpoints/:id - Get endpoint by ID
 * Requires member+ role in project's org
 */
export const getEndpoint: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.endpoint)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const data = await requireResource(db.services.endpoint, id, `Endpoint`)

    res.status(200).json({ data })
  },
}

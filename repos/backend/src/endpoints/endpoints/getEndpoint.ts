import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

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
    const { data, error } = await db.services.endpoint.get(id)

    if (error) throw new Exception(500, error.message)

    if (!data) throw new Exception(404, `Endpoint not found`)

    // Check permission based on endpoint's projectId
    await checkPermission(req, EPermAction.read, EPermResource.endpoint, {
      projectId: data.projectId,
    })

    res.status(200).json({ data })
  },
}

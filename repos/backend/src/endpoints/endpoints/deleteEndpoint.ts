import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * DELETE /endpoints/:id - Delete an endpoint
 * Requires admin+ role
 */
export const deleteEndpoint: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const { data: existing, error: getError } = await db.services.endpoint.get(id)

    if (getError) throw new Exception(500, getError.message)

    if (!existing) throw new Exception(404, `Endpoint not found`)

    // Check permission based on endpoint's projectId - requires admin+
    await checkPermission(req, EPermAction.delete, EPermResource.endpoint, {
      projectId: existing.projectId,
    })

    const { data, error } = await db.services.endpoint.delete(id)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { success: true, id } })
  },
}

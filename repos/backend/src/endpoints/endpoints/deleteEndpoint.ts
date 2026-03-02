import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

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

    await requireResourceWithPermission(
      req,
      db.services.endpoint,
      id,
      EPermAction.delete,
      EPermResource.endpoint,
      `Endpoint`,
      (data) => ({ orgId: req.params.orgId, projectId: data.projectId })
    )

    const { data, error } = await db.services.endpoint.delete(id)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { success: true, id } })
  },
}

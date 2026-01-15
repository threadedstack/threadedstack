import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
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

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existing) {
      res.status(404).json({ error: `Endpoint not found` })
      return
    }

    // Check permission based on endpoint's projectId - requires admin+
    await checkPermission(req, EPermAction.delete, EPermResource.endpoint, {
      projectId: existing.projectId,
    })

    const { data, error } = await db.services.endpoint.delete(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data: { success: true, id } })
  },
}

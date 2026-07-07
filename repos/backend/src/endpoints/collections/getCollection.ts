import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:orgId/projects/:projectId/collections/:name - Get a collection by name.
 * Requires member+ role in the project (collection:read).
 */
export const getCollection: TEndpointConfig = {
  path: `/:name`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.collection)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId, name } = req.params

    if (!projectId) throw new Exception(400, `projectId parameter required`)
    if (!name) throw new Exception(400, `Collection name is required`)

    const { data, error } = await db.services.collection.getByName(projectId, name)
    if (error) throw new Exception(500, error.message)
    if (!data) throw new Exception(404, `Collection not found`)

    res.status(200).json({ data })
  },
}

import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:orgId/projects/:projectId/collections - List a project's collections.
 * Requires member+ role in the project (collection:read).
 */
export const listCollections: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.collection)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId } = req.params

    if (!projectId) throw new Exception(400, `projectId parameter required`)

    const { data, error } = await db.services.collection.listByProject(projectId)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [] })
  },
}

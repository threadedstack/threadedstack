import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import {
  Exception,
  EPermAction,
  EPermResource,
  Collection as CollectionModel,
} from '@tdsk/domain'

/**
 * POST /:orgId/projects/:projectId/collections - Create a collection.
 * Requires member+ role in the project (collection:create).
 */
export const createCollection: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.collection)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const projectId = req.params.projectId || req.body.projectId
    const { name, description, schema } = req.body

    if (!projectId) throw new Exception(400, `Project ID is required`)
    if (!name) throw new Exception(400, `Collection name is required`)

    const collection = new CollectionModel({
      name,
      projectId,
      ...(description !== undefined && { description }),
      ...(schema !== undefined && { schema }),
    })

    const { data, error } = await db.services.collection.create(collection)
    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}

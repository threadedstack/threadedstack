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
 * PUT /:orgId/projects/:projectId/collections/:name - Update a collection.
 * Only the provided fields (name/description/schema) are changed.
 * Requires member+ role in the project (collection:update).
 */
export const updateCollection: TEndpointConfig = {
  path: `/:name`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.collection)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId, name } = req.params

    if (!projectId) throw new Exception(400, `projectId parameter required`)
    if (!name) throw new Exception(400, `Collection name is required`)

    const { data: existing, error: getErr } = await db.services.collection.getByName(
      projectId,
      name
    )
    if (getErr) throw new Exception(500, getErr.message)
    if (!existing) throw new Exception(404, `Collection not found`)

    const { name: newName, description, schema } = req.body

    const collection = new CollectionModel({
      ...existing,
      ...(newName !== undefined && { name: newName }),
      ...(description !== undefined && { description }),
      ...(schema !== undefined && { schema }),
    })

    const { data, error } = await db.services.collection.update(collection)
    if (error) throw new Exception(500, error.message)
    if (!data) throw new Exception(404, `Collection not found`)

    res.status(200).json({ data })
  },
}

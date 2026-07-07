import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /:orgId/projects/:projectId/collections/:name - Delete a collection.
 * Its records are removed via the FK cascade. Requires admin+ role in the
 * project (collection:delete).
 */
export const deleteCollection: TEndpointConfig = {
  path: `/:name`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.collection)],
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

    const { error } = await db.services.collection.delete(existing.id)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { success: true } })
  },
}

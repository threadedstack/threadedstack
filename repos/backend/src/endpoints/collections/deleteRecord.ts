import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /:orgId/projects/:projectId/collections/:name/records/:id - Delete a
 * record by id within a collection. Project + collection scoped. Requires admin+
 * role in the project (collection:delete).
 */
export const deleteRecord: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.collection)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId, name, id } = req.params

    if (!projectId) throw new Exception(400, `projectId parameter required`)
    if (!name) throw new Exception(400, `Collection name is required`)
    if (!id) throw new Exception(400, `Record id is required`)

    const { data, error } = await db.services.record.delete(projectId, name, id)
    if (error) throw new Exception(500, error.message)
    if (!data) throw new Exception(404, `Record not found`)

    res.status(200).json({ data: { success: true } })
  },
}

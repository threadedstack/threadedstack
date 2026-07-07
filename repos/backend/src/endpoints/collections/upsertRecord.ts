import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /:orgId/projects/:projectId/collections/:name/records - Create-or-replace
 * a record by id within a collection. The document is validated against the
 * collection schema when one is present. Requires member+ role in the project
 * (collection:create). The service surfaces 404 (collection missing) and 400
 * (schema validation) via its status field.
 */
export const upsertRecord: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.create, EPermResource.collection)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId, name } = req.params
    const { id, data: recordData } = req.body

    if (!projectId) throw new Exception(400, `projectId parameter required`)
    if (!name) throw new Exception(400, `Collection name is required`)
    if (!recordData || typeof recordData !== `object` || Array.isArray(recordData))
      throw new Exception(400, `Record data object is required`)

    const { data, error, status } = await db.services.record.upsert(projectId, name, {
      id,
      data: recordData,
    })
    if (error) throw new Exception(status || 500, error.message)

    res.status(200).json({ data })
  },
}

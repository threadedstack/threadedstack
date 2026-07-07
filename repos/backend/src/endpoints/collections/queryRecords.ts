import type { Response } from 'express'
import type { TRecordQuery } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * POST /:orgId/projects/:projectId/collections/:name/records/query - Query a
 * collection's records with the small, injection-safe query API (TRecordQuery
 * body). Always scoped to the project + collection. Requires member+ role in
 * the project (collection:read). A malformed query (unknown field, bad op) is a
 * client error surfaced as 400 by the query compiler.
 */
export const queryRecords: TEndpointConfig = {
  path: `/query`,
  method: EPMethod.Post,
  middleware: [authorize(EPermAction.read, EPermResource.collection)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId, name } = req.params

    if (!projectId) throw new Exception(400, `projectId parameter required`)
    if (!name) throw new Exception(400, `Collection name is required`)

    const query: TRecordQuery = (req.body as TRecordQuery) || {}

    const { data, error } = await db.services.record.query(projectId, name, query)
    if (error) throw new Exception(400, error.message)

    res.status(200).json({ data: data || [] })
  },
}

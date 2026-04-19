import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { parsePagination } from '@TBE/utils/pagination'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /endpoints - List all endpoints
 * Requires member+ role in project's org
 */
export const listEndpoints: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.endpoint)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId } = req.params

    // Require projectId
    if (!projectId) throw new Exception(400, `projectId parameter required`)

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.endpoint.list({
      limit,
      offset,
      where: { projectId: projectId as string },
    })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [], limit, offset })
  },
}

import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { parsePagination } from '@TBE/utils/pagination'

/**
 * GET /endpoints - List all endpoints
 * Requires member+ role in project's org
 */
export const listEndpoints: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId } = req.params

    // Require projectId
    if (!projectId) throw new Exception(400, `projectId parameter required`)

    // Check permission - requires member+ (viewer can also read per matrix)
    await checkPermission(req, EPermAction.read, EPermResource.endpoint, {
      projectId: projectId as string,
    })

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

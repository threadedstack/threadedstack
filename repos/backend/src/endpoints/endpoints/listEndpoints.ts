import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * GET /endpoints - List all endpoints
 * Requires member+ role in project's org
 */
export const listEndpoints: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId } = req.query

    // Require projectId
    if (!projectId) throw new Exception(400, `projectId query parameter required`)

    // Check permission - requires member+ (viewer can also read per matrix)
    await checkPermission(req, EPermAction.read, EPermResource.endpoint, {
      projectId: projectId as string,
    })

    const { data, error } = await db.services.endpoint.list()

    if (error) throw new Exception(500, error.message)

    let eps = data || []
    if (projectId) eps = eps.filter((e: any) => e.projectId === projectId)

    res.status(200).json({ data: eps })
  },
}

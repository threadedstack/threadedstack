import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { parsePagination } from '@TBE/utils/pagination'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * GET /_/functions - List all functions
 * Requires member+ role in the project
 */
export const listFunctions: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { projectId } = req.params

    // projectId is required
    if (!projectId) throw new Exception(400, `projectId parameter required`)

    // Check permission — include orgId so org-level roles are considered
    await checkPermission(req, EPermAction.read, EPermResource.function, {
      orgId: req.params.orgId,
      projectId: projectId as string,
    })

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.function.list({
      limit,
      offset,
      where: { projectId: projectId as string },
    })
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [], limit, offset })
  },
}

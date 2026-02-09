import type { Response } from 'express'
import type { Config } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { parsePagination } from '@TBE/utils/pagination'

/**
 * GET /_/configs - List all configs
 * Requires member+ role in the org/project/user scope
 */
export const listConfigs: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, projectId, userId } = req.query

    // Require at least one scope
    if (!orgId && !projectId && !userId)
      throw new Exception(400, `An orgId, projectId, or userId query parameter required`)

    // Check permission based on scope
    await checkPermission(req, EPermAction.read, EPermResource.config, {
      orgId: orgId as string | undefined,
      projectId: projectId as string | undefined,
    })

    const where: Record<string, string> = {}
    if (orgId) where.orgId = orgId as string
    if (projectId) where.projectId = projectId as string
    if (userId) where.userId = userId as string

    const { limit, offset } = parsePagination(req)

    const { data, error } = await db.services.config.list({ where, limit, offset })

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [], limit, offset })
  },
}

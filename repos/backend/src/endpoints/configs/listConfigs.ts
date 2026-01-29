import type { Response } from 'express'
import type { Config } from '@tdsk/domain'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

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

    const { data, error } = await db.services.config.list()

    if (error) throw new Exception(500, error.message)

    // Filter by scope if provided
    let configs: Config[] = data || []
    if (orgId) configs = configs.filter((c) => c.orgId === orgId)
    if (projectId) configs = configs.filter((c) => c.projectId === projectId)
    if (userId) configs = configs.filter((c) => c.userId === userId)

    res.status(200).json({ data: configs })
  },
}

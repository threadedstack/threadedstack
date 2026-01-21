import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { Config, EPermAction, EPermResource } from '@tdsk/domain'
import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * POST /_/configs - Create a new config
 * Requires admin+ role in the org/project
 */
export const createConfig: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { data, orgId, projectId, userId } = req.body

    if (!data) {
      res.status(400).json({ error: `Config data is required` })
      return
    }

    const hasOrg = !!orgId
    const hasProject = !!projectId
    const hasUser = !!userId

    if (!hasOrg && !hasProject && !hasUser) {
      res.status(400).json({ error: `Config must belong to an org, project, or user` })
      return
    }

    if ((hasOrg && hasProject) || (hasOrg && hasUser) || (hasProject && hasUser)) {
      res.status(400).json({
        error: `Config can only belong to one of: org, project, or user (exclusive arc)`,
      })
      return
    }

    // Check permission - requires admin+
    await checkPermission(req, EPermAction.create, EPermResource.config, {
      orgId,
      projectId,
    })

    try {
      const config = new Config({
        data,
        ...(orgId && { orgId }),
        ...(projectId && { projectId }),
        ...(userId && { userId }),
      })

      const { data: createdConfig, error } = await db.services.config.create(config)
      error
        ? res.status(500).json({ error: error.message })
        : res.status(201).json({ data: createdConfig })
    } catch (err) {
      const message = err instanceof Error ? err.message : `Failed to create config`
      res.status(500).json({ error: message })
    }
  },
}

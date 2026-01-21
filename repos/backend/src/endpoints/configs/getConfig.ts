import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /_/configs/:id - Get config by ID
 * Requires member+ role in the org/project
 */
export const getConfig: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    const { data: config, error } = await db.services.config.get(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!config) {
      res.status(404).json({ error: 'Config not found' })
      return
    }

    // Check permission based on config scope
    await checkPermission(req, EPermAction.read, EPermResource.config, {
      orgId: config.orgId,
      projectId: config.projectId,
    })

    res.status(200).json({ data: config })
  },
}

import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

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

    if (error) throw new Exception(500, error.message)

    if (!config) throw new Exception(404, `Config not found`)

    // Check permission based on config scope
    await checkPermission(req, EPermAction.read, EPermResource.config, {
      orgId: config.orgId,
      projectId: config.projectId,
    })

    res.status(200).json({ data: config })
  },
}

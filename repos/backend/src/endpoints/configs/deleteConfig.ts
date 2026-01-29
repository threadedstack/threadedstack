import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * DELETE /_/configs/:id - Delete config
 * Requires admin+ role in the org/project
 */
export const deleteConfig: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    const { data: config, error: fetchError } = await db.services.config.get(id)

    if (fetchError) {
      throw new Exception(500, fetchError.message)
    }

    if (!config) {
      throw new Exception(404, 'Config not found')
    }

    // Check permission
    await checkPermission(req, EPermAction.delete, EPermResource.config, {
      orgId: config.orgId,
      projectId: config.projectId,
    })

    const { error } = await db.services.config.delete(id)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ success: true })
  },
}

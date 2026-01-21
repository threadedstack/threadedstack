import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

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
      res.status(500).json({ error: fetchError.message })
      return
    }

    if (!config) {
      res.status(404).json({ error: 'Config not found' })
      return
    }

    // Check permission
    await checkPermission(req, EPermAction.delete, EPermResource.config, {
      orgId: config.orgId,
      projectId: config.projectId,
    })

    const { error } = await db.services.config.delete(id)
    error
      ? res.status(500).json({ error: error.message })
      : res.status(200).json({ success: true })
  },
}

import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { Config, EPermAction, EPermResource } from '@tdsk/domain'
import { EPMethod } from '@TBE/types'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * PUT /_/configs/:id - Update config
 * Requires admin+ role in the org/project
 */
export const updateConfig: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params
    const { data } = req.body

    const { data: existingConfig, error: fetchError } = await db.services.config.get(id)

    if (fetchError) {
      res.status(500).json({ error: fetchError.message })
      return
    }

    if (!existingConfig) {
      res.status(404).json({ error: 'Config not found' })
      return
    }

    // Check permission
    await checkPermission(req, EPermAction.update, EPermResource.config, {
      orgId: existingConfig.orgId,
      projectId: existingConfig.projectId,
    })

    const config = new Config({
      ...existingConfig,
      ...(data && { data }),
    })

    const { data: updatedConfig, error } = await db.services.config.update(config)
    error
      ? res.status(500).json({ error: error.message })
      : res.status(200).json({ data: updatedConfig })
  },
}

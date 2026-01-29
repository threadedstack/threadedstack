import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Config, EPermAction, EPermResource } from '@tdsk/domain'

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

    const { data: existing, error: fetchError } = await db.services.config.get(id)

    if (fetchError) throw new Exception(500, fetchError.message)

    if (!existing) throw new Exception(404, `Config not found`)

    // Check permission
    await checkPermission(req, EPermAction.update, EPermResource.config, {
      orgId: existing.orgId,
      projectId: existing.projectId,
    })

    const config = new Config({
      ...existing,
      ...(data && { data }),
    })

    const { data: updated, error } = await db.services.config.update(config)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: updated })
  },
}

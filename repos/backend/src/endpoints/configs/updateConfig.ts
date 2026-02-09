import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { Config, EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

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

    const existing = await requireResourceWithPermission(
      req,
      db.services.config,
      id,
      EPermAction.update,
      EPermResource.config,
      `Config`
    )

    const config = new Config({
      ...existing,
      ...(data && { data }),
    })

    const { data: updated, error } = await db.services.config.update(config)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: updated })
  },
}

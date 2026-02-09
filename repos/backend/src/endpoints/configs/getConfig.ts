import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

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

    const config = await requireResourceWithPermission(
      req,
      db.services.config,
      id,
      EPermAction.read,
      EPermResource.config,
      `Config`
    )

    res.status(200).json({ data: config })
  },
}

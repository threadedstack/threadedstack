import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

/**
 * GET /_/functions/:id - Get function by ID
 * Requires member+ role in the project
 */
export const getFunction: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    const func = await requireResourceWithPermission(
      req,
      db.services.function,
      id,
      EPermAction.read,
      EPermResource.function,
      `Function`
    )

    res.status(200).json({ data: func })
  },
}

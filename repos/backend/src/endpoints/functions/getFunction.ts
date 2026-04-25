import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResource } from '@TBE/utils/auth/requireResource'

/**
 * GET /_/functions/:id - Get function by ID
 * Requires member+ role in the project
 */
export const getFunction: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.function)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { id } = req.params

    const func = await requireResource(db.services.function, id, `Function`)

    res.status(200).json({ data: func })
  },
}

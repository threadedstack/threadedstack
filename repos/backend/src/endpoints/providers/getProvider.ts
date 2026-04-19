import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResource } from '@TBE/utils/auth/requireResource'

/**
 * GET /providers/:id - Get provider by ID
 * Checks membership in the provider's org
 */
export const getProvider: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.provider)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const data = await requireResource(db.services.provider, id, `Provider`)

    res.status(200).json({ data })
  },
}

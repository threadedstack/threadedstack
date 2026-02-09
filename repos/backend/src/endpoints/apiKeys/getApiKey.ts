import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { requireResourceWithPermission } from '@TBE/utils/auth/requireResource'

/**
 * GET /api-keys/:id - Get API key by ID (metadata only)
 * Requires admin+ role
 */
export const getApiKey: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const data = await requireResourceWithPermission(
      req,
      db.services.apiKey,
      id,
      EPermAction.read,
      EPermResource.apiKey,
      `API key`
    )

    res.status(200).json({ data: data.sanitize() })
  },
}

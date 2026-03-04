import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /assets/:id - Get a single asset by ID
 */
export const getAsset: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const { data, error } = await db.services.asset.get(id)
    if (error) throw new Exception(500, error.message)
    if (!data) throw new Exception(404, `Asset not found`)

    await checkPermission(req, EPermAction.read, EPermResource.asset, {
      orgId: data.orgId,
      projectId: data.projectId,
    })

    res.status(200).json({ data })
  },
}

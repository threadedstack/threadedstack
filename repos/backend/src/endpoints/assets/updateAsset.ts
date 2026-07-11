import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * PUT /assets/:id - Update an existing asset
 */
export const updateAsset: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.asset)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const { data: existing, error: getError } = await db.services.asset.get(id)
    if (getError) throw new Exception(500, getError.message)
    if (!existing) throw new Exception(404, `Asset not found`)

    const { name, type, url, meta, content } = req.body
    const updateData = {
      id,
      ...(name !== undefined && { name }),
      ...(type !== undefined && { type }),
      ...(url !== undefined && { url }),
      ...(meta !== undefined && { meta }),
      ...(content !== undefined && { content }),
    }

    const { data, error } = await db.services.asset.update(updateData)
    if (error)
      throw new Exception(500, error instanceof Error ? error.message : String(error))

    res.status(200).json({ data })
  },
}

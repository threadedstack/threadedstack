import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * DELETE /assets/:id - Delete an asset
 */
export const deleteAsset: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals

    const { data: existing, error: getError } = await db.services.asset.get(id)
    if (getError) throw new Exception(500, getError.message)
    if (!existing) throw new Exception(404, `Asset not found`)

    await checkPermission(req, EPermAction.delete, EPermResource.asset, {
      orgId: existing.orgId,
      projectId: existing.projectId,
    })

    const { error } = await db.services.asset.delete(id)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { success: true, id } })
  },
}

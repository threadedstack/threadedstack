import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /:orgId/overrides/expired - Delete all expired permission overrides
 * Requires role:manage permission (admin+)
 */
export const cleanupOverrides: TEndpointConfig = {
  path: `/expired`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.manage, EPermResource.role)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)

    const { data: deletedCount, error } =
      await db.services.permissionOverride.deleteExpired(orgId)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { deletedCount: deletedCount ?? 0 } })
  },
}

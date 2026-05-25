import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /:orgId/overrides - List permission overrides for an org
 * Requires role:manage permission (admin+)
 */
export const listOverrides: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.manage, EPermResource.role)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const { orgId, projectId } = req.params

    if (!orgId) throw new Exception(400, `orgId is required`)

    if (projectId) {
      const { data, error } =
        await db.services.permissionOverride.listForProject(projectId)
      if (error) throw new Exception(500, error.message)
      res.status(200).json({ data: data || [] })
      return
    }

    const { data, error } = await db.services.permissionOverride.listForOrg(orgId)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: data || [] })
  },
}

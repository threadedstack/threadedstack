import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { getUserRole } from '@TBE/utils/auth/checkPermission'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * GET /orgs/:id - Get org by ID
 * User must be a member of the org to view it
 * Returns org with user's role for that org
 */
export const getOrg: TEndpointConfig = {
  path: `/:orgId`,
  method: EPMethod.Get,
  middleware: [authorize(EPermAction.read, EPermResource.org)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId } = req.params
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { data, error } = await db.services.org.get(orgId)
    if (error) throw new Exception(500, error.message)
    if (!data) throw new Exception(404, `Org not found`)

    // Get user's role for this org
    const userRole = await getUserRole(req, { orgId })

    res.status(200).json({
      data: {
        ...data,
        userRole,
      },
    })
  },
}

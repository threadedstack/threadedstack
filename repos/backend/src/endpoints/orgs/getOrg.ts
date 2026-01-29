import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { requireOrgMember, getUserRole } from '@TBE/utils/auth/checkPermission'

/**
 * GET /orgs/:id - Get org by ID
 * User must be a member of the org to view it
 * Returns org with user's role for that org
 */
export const getOrg: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id: orgId } = req.params
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    // Check membership first
    await requireOrgMember(req, orgId)

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

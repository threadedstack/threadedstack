import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { isSuperAdmin } from '@tdsk/domain'
import { getUserRole } from '@TBE/utils/auth/checkPermission'

/**
 * GET /orgs - List all orgs
 * Only returns orgs where user is a member (super admins see all)
 */
export const listOrgs: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db } = req.app.locals
    const userId = req.user?.id

    if (!userId) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // Check if user is super admin
    const userRole = await getUserRole(req, {})
    const isSuper = isSuperAdmin(userRole)

    if (isSuper) {
      // Super admins can see all orgs
      const { data, error } = await db.services.org.list()

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      res.status(200).json({ data })
      return
    }

    // Get user's org IDs
    const { data: orgIds, error: orgIdsError } =
      await db.services.role.getUserOrgs(userId)

    if (orgIdsError) {
      res.status(500).json({ error: orgIdsError.message })
      return
    }

    // Fetch only orgs the user is a member of
    const { data: allOrgs, error: listError } = await db.services.org.list()

    if (listError) {
      res.status(500).json({ error: listError.message })
      return
    }

    const userOrgs = allOrgs?.filter((org) => orgIds?.includes(org.id)) || []

    res.status(200).json({ data: userOrgs })
  },
}

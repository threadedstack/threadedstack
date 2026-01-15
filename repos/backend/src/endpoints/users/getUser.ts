import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { Response } from 'express'

import { EPMethod } from '@TBE/types'
import { isSuperAdmin } from '@tdsk/domain'
import { getUserRole } from '@TBE/utils/auth/checkPermission'

/**
 * GET /users/:id - Get user by ID
 * Users can always view themselves
 * To view other users, need to share an org with them
 * Or be a super admin
 */
export const getUser: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const currentUserId = req.user?.id

    // Users can always view themselves
    const isOwnProfile = currentUserId === id

    // Check if super admin
    const userRole = await getUserRole(req, {})
    const isSuper = isSuperAdmin(userRole)

    if (!isOwnProfile && !isSuper) {
      // Check if they share an org
      const { data: currentUserOrgs } = await db.services.role.getUserOrgs(
        currentUserId || ''
      )
      const { data: targetUserOrgs } = await db.services.role.getUserOrgs(id)

      const sharedOrgs =
        currentUserOrgs?.filter((orgId) => targetUserOrgs?.includes(orgId)) || []

      if (sharedOrgs.length === 0) {
        res.status(403).json({ error: 'You do not have permission to view this user' })
        return
      }
    }

    const { data, error } = await db.services.user.get(id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    if (!data) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.status(200).json({ data })
  },
}

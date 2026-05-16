import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { Response } from 'express'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { isPlatformSuperAdmin } from '@TBE/utils/auth/isPlatformSuperAdmin'

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
    if (!currentUserId) throw new Exception(401, `Authentication required`)

    const isOwnProfile = currentUserId === id

    const isSuper = await isPlatformSuperAdmin(req)

    if (!isOwnProfile && !isSuper) {
      // Check if they share an org
      const { data: currentUserOrgs } = await db.services.role.getUserOrgs(
        currentUserId || ''
      )
      const { data: targetUserOrgs } = await db.services.role.getUserOrgs(id)

      const sharedOrgs =
        currentUserOrgs?.filter((orgId) => targetUserOrgs?.includes(orgId)) || []

      if (sharedOrgs.length === 0)
        throw new Exception(403, `You do not have permission to view this user`)
    }

    const { data, error } = await db.services.user.get(id)
    if (error) throw new Exception(500, error.message)
    if (!data) throw new Exception(404, `User not found`)

    res.status(200).json({ data })
  },
}

import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { Response } from 'express'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { checkPermission } from '@TBE/utils/auth/checkPermission'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * PUT /users/:id - Update an existing user
 * Users can update themselves (limited fields: name, avatar, etc.)
 * Admins can update other users in their org
 * Cannot update user's role here (use org member endpoints)
 */
export const updateUser: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  middleware: [authorize(EPermAction.update, EPermResource.user)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const { name, email, avatar, metadata, orgId: bodyOrgId } = req.body
    const currentUserId = req.user?.id
    const orgId = bodyOrgId as string | undefined

    const { data: existingUser, error: getError } = await db.services.user.get(id)
    if (getError) throw new Exception(500, getError.message)

    if (!existingUser) throw new Exception(404, `User not found`)

    // Users can update themselves
    const isOwnProfile = currentUserId === id

    if (isOwnProfile) {
      // Allow self-update (limited fields - role cannot be changed here)
      const filteredData = Object.fromEntries(
        Object.entries({ name, email, avatar, metadata }).filter(
          ([, v]) => v !== undefined
        )
      )

      const { data, error } = await db.services.user.update({ ...filteredData, id })

      if (error) throw new Exception(500, error.message)

      res.status(200).json({ data })
      return
    }

    // For updating other users, require admin in shared org
    if (orgId) {
      await checkPermission(req, EPermAction.update, EPermResource.user, { orgId })
    } else {
      // Find a shared org to check permissions
      const { data: currentUserOrgs } = await db.services.role.getUserOrgs(
        currentUserId || ``
      )
      const { data: targetUserOrgs } = await db.services.role.getUserOrgs(id)

      const sharedOrgs =
        currentUserOrgs?.filter((org) => targetUserOrgs?.includes(org)) || []

      if (sharedOrgs.length === 0) {
        throw new Exception(403, `You do not have permission to update this user`)
      }

      // Check admin permission in first shared org
      await checkPermission(req, EPermAction.update, EPermResource.user, {
        orgId: sharedOrgs[0],
      })
    }

    const adminAllowed: Record<string, unknown> = {}
    if (name !== undefined) adminAllowed.name = name
    if (email !== undefined) adminAllowed.email = email
    if (avatar !== undefined) adminAllowed.avatar = avatar
    if (metadata !== undefined) adminAllowed.metadata = metadata
    const { data, error } = await db.services.user.update({ ...adminAllowed, id })
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}

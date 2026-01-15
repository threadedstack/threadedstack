import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { Response } from 'express'

import { EPMethod } from '@TBE/types'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * PUT /users/:id - Update an existing user
 * Users can update themselves (limited fields: name, avatar, etc.)
 * Admins can update other users in their org
 * Cannot update user's role here (use org member endpoints)
 */
export const updateUser: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const userData = req.body
    const currentUserId = req.user?.id
    const orgId = userData.orgId as string | undefined

    // Check if user exists first
    const { data: existingUser, error: getError } = await db.services.user.get(id)

    if (getError) {
      res.status(500).json({ error: getError.message })
      return
    }

    if (!existingUser) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    // Users can update themselves
    const isOwnProfile = currentUserId === id

    if (isOwnProfile) {
      // Allow self-update (limited fields - role cannot be changed here)
      const allowedFields = ['name', 'avatar', 'email', 'metadata']
      const filteredData = Object.keys(userData)
        .filter((key) => allowedFields.includes(key))
        .reduce((obj, key) => {
          obj[key] = userData[key]
          return obj
        }, {} as any)

      const { data, error } = await db.services.user.update({ ...filteredData, id })

      if (error) {
        res.status(500).json({ error: error.message })
        return
      }

      res.status(200).json({ data })
      return
    }

    // For updating other users, require admin in shared org
    if (orgId) {
      await checkPermission(req, EPermAction.update, EPermResource.user, { orgId })
    } else {
      // Find a shared org to check permissions
      const { data: currentUserOrgs } = await db.services.role.getUserOrgs(
        currentUserId || ''
      )
      const { data: targetUserOrgs } = await db.services.role.getUserOrgs(id)

      const sharedOrgs =
        currentUserOrgs?.filter((org) => targetUserOrgs?.includes(org)) || []

      if (sharedOrgs.length === 0) {
        res.status(403).json({ error: 'You do not have permission to update this user' })
        return
      }

      // Check admin permission in first shared org
      await checkPermission(req, EPermAction.update, EPermResource.user, {
        orgId: sharedOrgs[0],
      })
    }

    const { data, error } = await db.services.user.update({ ...userData, id })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { Response } from 'express'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { EPermAction, EPermResource } from '@tdsk/domain'
import { checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * DELETE /users/:id - Delete a user (remove from org)
 * Users can delete themselves (deactivate account)
 * Requires owner+ to delete other users
 * Should remove from org, not delete user entirely
 */
export const deleteUser: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const currentUserId = req.user?.id
    const orgId = req.query.orgId as string | undefined

    // Check if user exists first
    const { data: existingUser, error: getError } = await db.services.user.get(id)
    if (getError) throw new Exception(500, getError.message)
    if (!existingUser) throw new Exception(404, `User not found`)

    // Users can delete themselves
    const isOwnProfile = currentUserId === id

    if (isOwnProfile) {
      const { data, error } = await db.services.user.delete(id)

      if (error) throw new Exception(500, error.message)

      res.status(200).json({ data, message: `Account deactivated` })
      return
    }

    // TODO: move remove from org into it's own endpoint
    // Deleting a user, and removing from an org are to very different things
    // For deleting other users, require owner+ permission
    if (!orgId)
      throw new Exception(400, `orgId query parameter required to remove users from org`)

    await checkPermission(req, EPermAction.delete, EPermResource.user, { orgId })

    // Remove user from the org (not full deletion)
    const { data, error } = await db.services.role.removeFromOrg(id, orgId)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: { success: true, id, removedFrom: orgId } })
  },
}

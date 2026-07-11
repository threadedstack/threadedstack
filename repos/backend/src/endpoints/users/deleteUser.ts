import type { TEndpointConfig, TRequest } from '@TBE/types'
import type { Response } from 'express'

import { EPMethod } from '@TBE/types'
import { authorize } from '@TBE/middleware/authorize'
import { Exception, EPermAction, EPermResource } from '@tdsk/domain'

/**
 * DELETE /users/:id - Delete a user
 * Users can delete themselves (deactivate account)
 * To remove another user from an org, use DELETE /orgs/:id/members/:userId (removeOrgMember)
 */
export const deleteUser: TEndpointConfig = {
  path: `/:id`,
  method: EPMethod.Delete,
  middleware: [authorize(EPermAction.delete, EPermResource.user)],
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id } = req.params
    const { db } = req.app.locals
    const currentUserId = req.user?.id

    const { data: existingUser, error: getError } = await db.services.user.get(id)
    if (getError) throw new Exception(500, getError.message)
    if (!existingUser) throw new Exception(404, `User not found`)

    // Users can delete themselves
    const isOwnProfile = currentUserId === id

    if (!isOwnProfile)
      throw new Exception(
        403,
        `Cannot delete another user directly. To remove a member from an org, use DELETE /orgs/:id/members/:userId`,
        `FORBIDDEN`
      )

    const { data, error } = await db.services.user.delete(id)

    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data, message: `Account deactivated` })
  },
}

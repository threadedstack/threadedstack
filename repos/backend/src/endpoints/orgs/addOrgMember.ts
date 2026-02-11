import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'
import { ERoleType, EPermAction, EPermResource, canManageRole } from '@tdsk/domain'

/**
 * POST /orgs/:id/members - Add a member to a org
 * Creates a role entry linking the user to the org
 * Requires admin+ role to add members
 * Cannot add someone with higher role than yourself
 */
export const addOrgMember: TEndpointConfig = {
  path: `/:orgId/members`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId } = req.params
    const { db } = req.app.locals
    const { userId, type = ERoleType.member } = req.body
    const currentUserId = req.user?.id

    if (!currentUserId) throw new Exception(401, `Authentication required`)
    if (!userId) throw new Exception(400, `userId is required`)

    // Check permission (requires admin+ to manage members)
    await checkPermission(req, EPermAction.manage, EPermResource.org, { orgId })

    // Get current user's role to validate they can assign the requested role
    const currentUserRole = await getUserRole(req, { orgId })
    const targetRole = type as ERoleType

    if (!canManageRole(currentUserRole, targetRole))
      throw new Exception(
        403,
        `You cannot add a member with ${targetRole} role. You can only add members with roles below your own.`,
        `FORBIDDEN`
      )

    // Check if org exists
    const { data: existingOrg, error: orgError } = await db.services.org.get(orgId)

    if (orgError) throw new Exception(500, orgError.message)

    if (!existingOrg) throw new Exception(404, `Org not found`)

    // Check if user exists
    const { data: existingUser, error: userError } = await db.services.user.get(userId)

    if (userError) throw new Exception(500, userError.message)

    if (!existingUser) throw new Exception(404, `User not found`)

    // Create role (org membership)
    const { data, error } = await db.services.role.create({
      orgId,
      userId,
      type: targetRole,
    })

    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}

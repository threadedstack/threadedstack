import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import {
  Exception,
  ERoleType,
  EPermAction,
  EPermResource,
  canManageRole,
} from '@tdsk/domain'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'

/**
 * DELETE /orgs/:id/members/:userId - Remove a member from a org
 * Deletes the role entry linking the user to the org
 * Requires admin+ role to remove members
 * Cannot remove owners (must transfer ownership first)
 * Cannot remove someone with equal or higher role than yourself
 */
export const removeOrgMember: TEndpointConfig = {
  path: `/:orgId/members/:userId`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId, userId } = req.params
    const { db } = req.app.locals
    const currentUserId = req.user?.id

    if (!currentUserId) throw new Exception(401, `Authentication required`)

    // Check permission (requires admin+ to manage members)
    await checkPermission(req, EPermAction.manage, EPermResource.org, { orgId })

    // Check if org exists
    const { data: existingOrg, error: orgError } = await db.services.org.get(orgId)

    if (orgError) throw new Exception(500, orgError.message)

    if (!existingOrg) throw new Exception(404, `Org not found`)

    // Get the target user's role
    const { data: targetRole, error: targetRoleError } =
      await db.services.role.getOrgRole(userId, orgId)

    if (targetRoleError) throw new Exception(500, targetRoleError.message)

    if (!targetRole) throw new Exception(404, `Org member not found`)

    // Prevent removing owners
    if (targetRole.type === ERoleType.owner)
      throw new Exception(
        403,
        `Cannot remove owner from organization. Transfer ownership first.`,
        `FORBIDDEN`
      )

    // Check if current user can manage this role
    const currentUserRole = await getUserRole(req, { orgId })
    if (!canManageRole(currentUserRole, targetRole.type as ERoleType))
      throw new Exception(
        403,
        `You cannot remove members with equal or higher roles than your own.`,
        `FORBIDDEN`
      )

    const { data, error } = await db.services.role.delete(targetRole.id)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data })
  },
}

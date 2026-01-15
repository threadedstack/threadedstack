import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'
import { ERoleType, EPermAction, EPermResource, canManageRole } from '@tdsk/domain'

/**
 * DELETE /orgs/:id/members/:userId - Remove a member from a org
 * Deletes the role entry linking the user to the org
 * Requires admin+ role to remove members
 * Cannot remove owners (must transfer ownership first)
 * Cannot remove someone with equal or higher role than yourself
 */
export const removeOrgMember: TEndpointConfig = {
  path: `/:id/members/:userId`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id: orgId, userId } = req.params
    const { db } = req.app.locals
    const currentUserId = req.user?.id

    if (!currentUserId) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    // Check permission (requires admin+ to manage members)
    await checkPermission(req, EPermAction.manage, EPermResource.org, { orgId })

    // Check if org exists
    const { data: existingOrg, error: orgError } = await db.services.org.get(orgId)

    if (orgError) {
      res.status(500).json({ error: orgError.message })
      return
    }

    if (!existingOrg) {
      res.status(404).json({ error: `Org not found` })
      return
    }

    // Get the target user's role
    const { data: targetRole, error: targetRoleError } =
      await db.services.role.getOrgRole(userId, orgId)

    if (targetRoleError) {
      res.status(500).json({ error: targetRoleError.message })
      return
    }

    if (!targetRole) {
      res.status(404).json({ error: `Org member not found` })
      return
    }

    // Prevent removing owners
    if (targetRole.type === ERoleType.owner) {
      throw new Exception(
        403,
        'Cannot remove owner from organization. Transfer ownership first.',
        'FORBIDDEN'
      )
    }

    // Check if current user can manage this role
    const currentUserRole = await getUserRole(req, { orgId })
    if (!canManageRole(currentUserRole, targetRole.type as ERoleType)) {
      throw new Exception(
        403,
        'You cannot remove members with equal or higher roles than your own.',
        'FORBIDDEN'
      )
    }

    const { data, error } = await db.services.role.delete(targetRole.id)

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

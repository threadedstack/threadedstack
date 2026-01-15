import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@TBE/utils/errors/exception'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'
import type { ERoleType } from '@tdsk/domain'
import { EPermAction, EPermResource, canManageRole } from '@tdsk/domain'

/**
 * PUT /orgs/:id/members/:userId - Update member role in an org
 * Requires admin+ role to change member roles
 * Cannot promote someone to or above your own role
 */
export const updateMemberRole: TEndpointConfig = {
  path: `/:id/members/:userId`,
  method: EPMethod.Put,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id: orgId, userId } = req.params
    const { db } = req.app.locals
    const { type: newRoleType } = req.body
    const currentUserId = req.user?.id

    if (!currentUserId) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    if (!newRoleType) {
      res.status(400).json({ error: 'Role type is required' })
      return
    }

    // Check permission (requires admin+ to manage members)
    await checkPermission(req, EPermAction.manage, EPermResource.org, { orgId })

    // Get current user's role
    const currentUserRole = await getUserRole(req, { orgId })
    const targetRole = newRoleType as ERoleType

    // Cannot promote to or above your own role
    if (!canManageRole(currentUserRole, targetRole)) {
      throw new Exception(
        403,
        `You cannot assign ${targetRole} role. You can only assign roles below your own.`,
        'FORBIDDEN'
      )
    }

    // Get the target user's current role
    const { data: existingRole, error: roleError } = await db.services.role.getOrgRole(
      userId,
      orgId
    )

    if (roleError) {
      res.status(500).json({ error: roleError.message })
      return
    }

    if (!existingRole) {
      res.status(404).json({ error: 'Org member not found' })
      return
    }

    // Check if current user can manage the target's current role
    if (!canManageRole(currentUserRole, existingRole.type as ERoleType)) {
      throw new Exception(
        403,
        'You cannot modify roles of members with equal or higher roles than your own.',
        'FORBIDDEN'
      )
    }

    // Update the role
    const { data, error } = await db.services.role.updateOrgRole(
      userId,
      orgId,
      targetRole
    )

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(200).json({ data })
  },
}

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
  path: `/:id/members`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { id: orgId } = req.params
    const { db } = req.app.locals
    const { userId, type = ERoleType.member } = req.body
    const currentUserId = req.user?.id

    if (!currentUserId) {
      res.status(401).json({ error: 'Authentication required' })
      return
    }

    if (!userId) {
      res.status(400).json({ error: `userId is required` })
      return
    }

    // Check permission (requires admin+ to manage members)
    await checkPermission(req, EPermAction.manage, EPermResource.org, { orgId })

    // Get current user's role to validate they can assign the requested role
    const currentUserRole = await getUserRole(req, { orgId })
    const targetRole = type as ERoleType

    if (!canManageRole(currentUserRole, targetRole)) {
      throw new Exception(
        403,
        `You cannot add a member with ${targetRole} role. You can only add members with roles below your own.`,
        'FORBIDDEN'
      )
    }

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

    // Check if user exists
    const { data: existingUser, error: userError } = await db.services.user.get(userId)

    if (userError) {
      res.status(500).json({ error: userError.message })
      return
    }

    if (!existingUser) {
      res.status(404).json({ error: `User not found` })
      return
    }

    // Create role (org membership)
    const { data, error } = await db.services.role.create({
      orgId,
      userId,
      type: targetRole,
    })

    if (error) {
      res.status(500).json({ error: error.message })
      return
    }

    res.status(201).json({ data })
  },
}

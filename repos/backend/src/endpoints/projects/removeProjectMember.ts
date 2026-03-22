import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'
import {
  Exception,
  ERoleType,
  EPermAction,
  EPermResource,
  canManageRole,
} from '@tdsk/domain'

/**
 * DELETE /orgs/:orgId/projects/:projectId/members/:userId - Remove a member from a project
 * Deletes the role entry linking the user to the project
 * Requires admin+ role to remove members
 * Cannot remove owners (must transfer ownership first)
 * Cannot remove someone with equal or higher role than yourself
 */
export const removeProjectMember: TEndpointConfig = {
  path: `/:userId`,
  method: EPMethod.Delete,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId, projectId, userId } = req.params
    const { db } = req.app.locals
    const currentUserId = req.user?.id

    if (!currentUserId) throw new Exception(401, `Authentication required`)

    // Check permission (requires admin+ to manage project members)
    await checkPermission(req, EPermAction.manage, EPermResource.project, {
      orgId,
      projectId,
    })

    // Get the target user's role
    const { data: targetRole, error: targetRoleError } =
      await db.services.role.getProjectRole(userId, projectId)

    if (targetRoleError) throw new Exception(500, targetRoleError.message)

    if (!targetRole) throw new Exception(404, `Project member not found`)

    // Prevent removing owners
    if (targetRole.type === ERoleType.owner)
      throw new Exception(
        403,
        `Cannot remove owner from project. Transfer ownership first.`,
        `FORBIDDEN`
      )

    // Check if current user can manage this role
    const currentUserRole = await getUserRole(req, { orgId, projectId })
    if (!canManageRole(currentUserRole, targetRole.type as ERoleType))
      throw new Exception(
        403,
        `You cannot remove members with equal or higher roles than your own.`,
        `FORBIDDEN`
      )

    const { error } = await db.services.role.removeFromProject(userId, projectId)
    if (error) throw new Exception(500, error.message)

    res.status(200).json({ data: targetRole })
  },
}

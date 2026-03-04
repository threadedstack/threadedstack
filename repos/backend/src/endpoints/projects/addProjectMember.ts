import type { Response } from 'express'
import type { TEndpointConfig, TRequest } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { getUserRole, checkPermission } from '@TBE/utils/auth/checkPermission'
import { ERoleType, EPermAction, EPermResource, canManageRole } from '@tdsk/domain'

/**
 * POST /orgs/:orgId/projects/:projectId/members - Add a member to a project
 * Creates a role entry linking the user to the project
 * Requires admin+ role to add members
 * Target user must be an org member first
 * Cannot add someone with higher role than yourself
 */
export const addProjectMember: TEndpointConfig = {
  path: `/`,
  method: EPMethod.Post,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { orgId, projectId } = req.params
    const { db } = req.app.locals
    const { userId, roleType = ERoleType.member } = req.body
    const currentUserId = req.user?.id

    if (!currentUserId) throw new Exception(401, `Authentication required`)
    if (!userId) throw new Exception(400, `userId is required`)

    const validRoles = Object.values(ERoleType) as string[]
    if (!validRoles.includes(roleType as string))
      throw new Exception(
        400,
        `Invalid role type. Must be one of: ${validRoles.join(', ')}`
      )

    // Check permission (requires admin+ to manage project members)
    await checkPermission(req, EPermAction.manage, EPermResource.project, {
      orgId,
      projectId,
    })

    // Get current user's role to validate they can assign the requested role
    const currentUserRole = await getUserRole(req, { orgId, projectId })
    const targetRole = roleType as ERoleType

    if (!canManageRole(currentUserRole, targetRole))
      throw new Exception(
        403,
        `You cannot add a member with ${targetRole} role. You can only add members with roles below your own.`,
        `FORBIDDEN`
      )

    // Check if target user is an org member first
    const { data: isOrgMember, error: orgMemberError } =
      await db.services.role.isOrgMember(userId, orgId)

    if (orgMemberError) throw new Exception(500, orgMemberError.message)

    if (!isOrgMember)
      throw new Exception(
        400,
        `User must be an organization member before being added to a project`
      )

    // Check if project exists
    const { data: existingProject, error: projectError } =
      await db.services.project.get(projectId)

    if (projectError) throw new Exception(500, projectError.message)

    if (!existingProject) throw new Exception(404, `Project not found`)

    // Create role (project membership)
    const { data, error } = await db.services.role.create({
      projectId,
      userId,
      type: targetRole,
    })

    if (error) throw new Exception(500, error.message)

    res.status(201).json({ data })
  },
}

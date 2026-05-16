import type { TRequest } from '@TBE/types'

import { getUserRole } from '@TBE/utils/auth/checkPermission'
import { Exception, ERoleType, hasMinRole } from '@tdsk/domain'

/**
 * Enforce project membership for project-scoped resources.
 * Org admins+ bypass this check and can access any project.
 * Non-admin org members must have an explicit project role.
 */
export const requireProjectAccess = async (
  req: TRequest,
  projectId: string,
  orgId: string
): Promise<void> => {
  const { db } = req.app.locals
  const userId = req.user?.id

  if (!userId) throw new Exception(401, `Authentication required`, `UNAUTHORIZED`)

  const userRole = await getUserRole(req, { orgId })
  if (hasMinRole(userRole, ERoleType.admin)) return

  const { data: isMember, error } = await db.services.role.isProjectMember(
    userId,
    projectId
  )
  if (error) throw new Exception(500, `Failed to check project membership`)

  if (!isMember) {
    throw new Exception(
      403,
      `Access denied: you are not a member of this project`,
      `FORBIDDEN`
    )
  }
}

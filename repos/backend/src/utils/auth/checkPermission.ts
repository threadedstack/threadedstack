import type { TRequest, TPermissionContext } from '@TBE/types'
import type { EPermAction, EPermResource } from '@tdsk/domain'
import type { ERoleType } from '@tdsk/domain'
import { Exception, canPerform, isSuperAdmin, getHighestRole } from '@tdsk/domain'

/**
 * Get user`s effective role for the given context
 * Checks org-level and project-level roles, returns highest
 * Returns null for non-members (no role found)
 */
export const getUserRole = async (
  req: TRequest,
  context: TPermissionContext
): Promise<ERoleType | null> => {
  const { db } = req.app.locals
  const userId = req.user?.id

  if (!userId) return null

  const roles: ERoleType[] = []

  if (context.orgId) {
    const { data: orgRole } = await db.services.role.getOrgRole(userId, context.orgId)
    if (orgRole?.type) {
      roles.push(orgRole.type as ERoleType)
    }
  }

  if (context.projectId) {
    const { data: projectRole } = await db.services.role.getProjectRole(
      userId,
      context.projectId
    )
    if (projectRole?.type) roles.push(projectRole.type as ERoleType)
  }

  return roles.length > 0 ? getHighestRole(roles) : null
}

/**
 * Check if user can perform action on resource
 * Throws Exception if not allowed
 */
export const checkPermission = async (
  req: TRequest,
  action: EPermAction,
  resource: EPermResource,
  context: TPermissionContext = {}
): Promise<void> => {
  const userRole = await getUserRole(req, context)

  if (userRole !== null && isSuperAdmin(userRole)) return

  const result = canPerform(userRole, action, resource)

  if (!result.allowed)
    throw new Exception(
      403,
      result.reason || `Permission denied: cannot ${action} ${resource}`,
      `FORBIDDEN`
    )
}

import type { TRequest } from '@TBE/types'
import type { EPermAction, EPermResource, TPermissionContext } from '@tdsk/domain'
import type { ERoleType } from '@tdsk/domain'
import {
  Exception,
  canPerform,
  isSuperAdmin,
  getHighestRole,
  getAuthHeader,
  RoleHierarchy,
  ApiKeyAllowedRoles,
} from '@tdsk/domain'

/**
 * Get user`s effective role for the given context
 * Checks org-level and project-level roles, returns highest
 * Caps by API key role when request is made via API key
 * Returns null for non-members (no role found)
 * Throws on DB errors to prevent silent permission denials
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
    const { data: orgRole, error: orgErr } = await db.services.role.getOrgRole(
      userId,
      context.orgId
    )
    if (orgErr) throw new Exception(500, `Role lookup failed: ${orgErr.message}`)
    if (orgRole?.type) {
      roles.push(orgRole.type as ERoleType)
    }
  }

  if (context.projectId) {
    const { data: projectRole, error: projErr } = await db.services.role.getProjectRole(
      userId,
      context.projectId
    )
    if (projErr) throw new Exception(500, `Role lookup failed: ${projErr.message}`)
    if (projectRole?.type) roles.push(projectRole.type as ERoleType)
  }

  const userDbRole = roles.length > 0 ? getHighestRole(roles) : null

  if (!userDbRole) return null

  const apiKeyRole = getAuthHeader(req, `apiKeyRole`) as ERoleType | undefined
  if (apiKeyRole) {
    if (!ApiKeyAllowedRoles.includes(apiKeyRole))
      throw new Exception(403, `Invalid API key role: ${apiKeyRole}`, `FORBIDDEN`)

    const dbLevel = RoleHierarchy.indexOf(userDbRole)
    const keyLevel = RoleHierarchy.indexOf(apiKeyRole)
    if (keyLevel < dbLevel) return apiKeyRole
  }

  return userDbRole
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

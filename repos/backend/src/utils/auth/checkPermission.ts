import type { TRequest } from '@TBE/types'
import type {
  EPermAction,
  TPermission,
  EPermResource,
  TPermissionContext,
} from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { ERoleType, EPermScope, Exception, getHighestRole } from '@tdsk/domain'
import { resolveEffectivePermissions } from '@TBE/utils/auth/resolveEffectivePermissions'

/**
 * Get user's effective role for the given context
 * Checks org-level and project-level roles, returns highest
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
    if (orgRole?.type) roles.push(orgRole.type as ERoleType)
  }

  if (context.projectId && context.scopeType !== EPermScope.org) {
    const { data: projectRole, error: projErr } = await db.services.role.getProjectRole(
      userId,
      context.projectId
    )
    if (projErr) throw new Exception(500, `Role lookup failed: ${projErr.message}`)
    if (projectRole?.type) roles.push(projectRole.type as ERoleType)
  }

  if (roles.length === 0 && (context.orgId || context.projectId))
    logger.warn({
      userId,
      orgId: context.orgId,
      projectId: context.projectId,
      message: `getUserRole found no roles for user in scope`,
    })

  return roles.length > 0 ? getHighestRole(roles) : null
}

/**
 * Check if user can perform action on resource.
 * Uses resolveEffectivePermissions to combine role-based permissions
 * with any per-user overrides. Caches resolved permissions on the request.
 * Throws Exception if not allowed.
 */
export const checkPermission = async (
  req: TRequest,
  action: EPermAction,
  resource: EPermResource,
  context: TPermissionContext = {}
): Promise<void> => {
  const permissions = await resolveEffectivePermissions(req, context)

  if (permissions === ERoleType.super) return

  const permission: TPermission = `${resource}:${action}`
  if (!permissions.has(permission))
    throw new Exception(403, `Permission denied: requires ${permission}`, `FORBIDDEN`)

    // Cache resolved permissions on request for downstream use
  ;(req as any).permissions = permissions
}

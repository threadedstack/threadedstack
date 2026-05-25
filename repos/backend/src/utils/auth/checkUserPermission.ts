import type { TDatabase } from '@tdsk/database'
import type {
  EPermAction,
  EPermResource,
  TPermission,
  PermissionOverride,
} from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import type { ERoleType } from '@tdsk/domain'
import {
  isSuperAdmin,
  getHighestRole,
  resolvePermissions,
  buildRolePermissions,
} from '@tdsk/domain'

/**
 * Standalone permission check that resolves overrides without requiring Express TRequest.
 *
 * This mirrors the logic in resolveEffectivePermissions + checkPermission, but
 * accepts raw parameters (db, userId, orgId) so it can be used by WebSocket
 * handlers that do not go through Express middleware.
 *
 * When called via an API key path, pass `apiKeyPermissions` so the resolved
 * permission set is intersected with the key's grants.
 */
export const checkUserPermission = async (
  db: TDatabase,
  userId: string,
  orgId: string,
  action: EPermAction,
  resource: EPermResource,
  projectId?: string,
  apiKeyPermissions?: TPermission[]
): Promise<{ allowed: boolean; reason?: string }> => {
  const roles: ERoleType[] = []

  const { data: orgRole, error: orgErr } = await db.services.role.getOrgRole(
    userId,
    orgId
  )
  if (orgErr) {
    logger.error(
      `[checkUserPermission] Org role lookup failed for user ${userId} in org ${orgId}:`,
      orgErr
    )
    return { allowed: false, reason: `Permission check failed, please retry` }
  }
  if (orgRole?.type) roles.push(orgRole.type as ERoleType)

  if (projectId) {
    const { data: projectRole, error: projErr } = await db.services.role.getProjectRole(
      userId,
      projectId
    )
    if (projErr) {
      logger.error(
        `[checkUserPermission] Project role lookup failed for user ${userId} in project ${projectId}:`,
        projErr
      )
      return { allowed: false, reason: `Permission check failed, please retry` }
    }
    if (projectRole?.type) roles.push(projectRole.type as ERoleType)
  }

  const userRole = roles.length > 0 ? getHighestRole(roles) : null
  if (!userRole) return { allowed: false, reason: `Not a member of this organization` }
  if (isSuperAdmin(userRole)) return { allowed: true }

  const scopeContext = projectId ? { projectId } : { orgId }
  const { data: overrides, error: overrideErr } =
    await db.services.permissionOverride.getForUser(userId, scopeContext)
  if (overrideErr) {
    logger.error(
      `[checkUserPermission] Override lookup failed for user ${userId}:`,
      overrideErr
    )
    return { allowed: false, reason: `Permission check failed, please retry` }
  }

  let permissions: Set<TPermission>
  if (!overrides?.length) {
    permissions = new Set<TPermission>(buildRolePermissions(userRole))
  } else {
    permissions = resolvePermissions(userRole, overrides as PermissionOverride[])
  }

  // Intersect with API key permissions when the request came via an API key.
  // undefined = no API key (no restriction); [] = key with zero grants (deny all)
  if (apiKeyPermissions) {
    const keyPerms = new Set<TPermission>(apiKeyPermissions)
    for (const perm of [...permissions]) {
      if (!keyPerms.has(perm)) permissions.delete(perm)
    }
  }

  const permission: TPermission = `${resource}:${action}`
  if (permissions.has(permission)) return { allowed: true }
  return { allowed: false, reason: `Permission denied: requires ${permission}` }
}

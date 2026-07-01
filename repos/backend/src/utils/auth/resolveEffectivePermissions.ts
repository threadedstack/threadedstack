import type { TRequest } from '@TBE/types'
import type { TPermission, TPermissionContext, PermissionOverride } from '@tdsk/domain'

import { getUserRole } from './checkPermission'
import {
  ERoleType,
  Exception,
  EPermScope,
  isSuperAdmin,
  fromAuthHeaders,
  resolvePermissions,
  buildRolePermissions,
  filterPermissionsByScope,
} from '@tdsk/domain'

/**
 * Resolve the effective permission set for the current request user.
 *
 * 1. Look up the user's highest org/project role via getUserRole.
 * 2. If super admin, return the sentinel 'super' (bypasses all checks).
 * 3. If scoped context has overrides, merge them via resolvePermissions.
 * 4. Otherwise build the base permission set from role templates.
 * 5. If the request was made via API key, intersect the resolved permissions
 *    with the key's permissions so the key can never exceed its own grants.
 *
 * @param targetUserId optional override for the user whose permissions are
 *   resolved. Used by `createApiKey` to validate cross-user key requests
 *   against the target user's effective permissions without mutating the
 *   request object (spreading an Express `Request` loses prototype getters
 *   like `req.app`).
 * @returns A Set of effective permissions, or the string 'super'.
 */
export const resolveEffectivePermissions = async (
  req: TRequest,
  context: TPermissionContext,
  targetUserId?: string
): Promise<Set<TPermission> | ERoleType.super> => {
  const { db } = req.app.locals
  const userId = targetUserId || req.user?.id
  if (!userId) throw new Exception(401, `Authentication required`)

  const userRole = await getUserRole(req, context, targetUserId)
  if (!userRole) {
    if (context.projectId && !context.orgId)
      throw new Exception(403, `Not a member of this project`, `FORBIDDEN`)
    if (context.orgId && !context.projectId)
      throw new Exception(403, `Not a member of this organization`, `FORBIDDEN`)
    if (context.orgId && context.projectId)
      throw new Exception(
        403,
        `Not a member of this organization or project`,
        `FORBIDDEN`
      )
    throw new Exception(
      400,
      `Permission check requires org or project scope`,
      `MISSING_SCOPE`
    )
  }
  if (isSuperAdmin(userRole)) return ERoleType.super

  const scopeId = context.projectId || context.orgId
  let permissions: Set<TPermission>

  if (!scopeId) {
    permissions = new Set<TPermission>(buildRolePermissions(userRole))
  } else {
    const overrideContext = context.projectId
      ? { projectId: context.projectId }
      : { orgId: context.orgId }

    const { data: overrides, error: overrideErr } =
      await db.services.permissionOverride.getForUser(userId, overrideContext)
    // ^ permission overrides are looked up against the resolved userId so
    //   that targetUserId overrides see the right per-user overrides.
    if (overrideErr)
      throw new Exception(
        500,
        `Failed to resolve permission overrides: ${overrideErr.message}`
      )

    if (!overrides?.length) {
      permissions = new Set<TPermission>(buildRolePermissions(userRole))
    } else {
      permissions = resolvePermissions(userRole, overrides as PermissionOverride[])
    }
  }

  // If the request was made via API key, intersect resolved permissions
  // with the key's granted permissions so the key can never exceed its scope.
  // When `targetUserId` is set we are computing a DIFFERENT user's effective
  // permissions (e.g. for cross-user key validation in createApiKey). The
  // caller's key bounds the caller, not the target, so skip the intersection.
  const apiKeyId = targetUserId ? undefined : fromAuthHeaders(req).apiKeyId
  if (apiKeyId) {
    const { data: apiKey, error: keyErr } = await db.services.apiKey.get(apiKeyId)

    if (keyErr)
      throw new Exception(500, `Failed to resolve API key permissions: ${keyErr.message}`)

    if (!apiKey) throw new Exception(401, `API key not found`)
    if (apiKey.permissions) {
      const keyPerms = new Set<TPermission>(apiKey.permissions as TPermission[])
      for (const perm of [...permissions])
        if (!keyPerms.has(perm)) permissions.delete(perm)
    }

    if (apiKey.projectId) {
      const projectPerms = filterPermissionsByScope([...permissions], EPermScope.project)
      const projectPermSet = new Set(projectPerms)

      for (const perm of [...permissions])
        if (!projectPermSet.has(perm)) permissions.delete(perm)
    }
  }

  return permissions
}

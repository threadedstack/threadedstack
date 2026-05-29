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
 * @returns A Set of effective permissions, or the string 'super'.
 */
export const resolveEffectivePermissions = async (
  req: TRequest,
  context: TPermissionContext
): Promise<Set<TPermission> | ERoleType.super> => {
  const { db } = req.app.locals
  const userId = req.user?.id
  if (!userId) throw new Exception(401, `Authentication required`)

  const userRole = await getUserRole(req, context)
  if (!userRole)
    throw new Exception(403, `Not a member of this organization or project`, `FORBIDDEN`)
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
  // with the key's granted permissions so the key can never exceed its scope
  const apiKeyId = fromAuthHeaders(req).apiKeyId
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

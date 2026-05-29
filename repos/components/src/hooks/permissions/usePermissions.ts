import type { TUsePermissions } from '@TSC/types'
import type { TPermission, EPermResource, PermissionOverride } from '@tdsk/domain'

import { useMemo } from 'react'
import { EmptyPermissions } from '@TSC/constants/values'
import {
  ERoleType,
  hasMinRole,
  canManageRole,
  ERoleType as ERT,
  resolvePermissions,
  buildRolePermissions,
} from '@tdsk/domain'

export const usePermissions = (
  role: ERoleType | null,
  overrides?: PermissionOverride[],
  serverPermissions?: TPermission[] | `${ERoleType.super}`
): TUsePermissions => {
  return useMemo((): TUsePermissions => {
    if (!role) return EmptyPermissions

    const permissions =
      serverPermissions === ERoleType.super
        ? new Set<TPermission>(buildRolePermissions(ERoleType.owner))
        : Array.isArray(serverPermissions) && serverPermissions.length
          ? new Set<TPermission>(serverPermissions)
          : overrides?.length
            ? resolvePermissions(role, overrides)
            : new Set<TPermission>(buildRolePermissions(role))

    const has = (perm: TPermission) => {
      if (role === ERT.super || serverPermissions === ERoleType.super) return true
      return permissions.has(perm)
    }

    return {
      has,
      role,
      permissions,
      isSuper: role === ERT.super,
      canDeleteOrg: has(`org:delete`),
      canManageMembers: has(`org:manage`),
      isAdmin: hasMinRole(role, ERT.admin),
      isMember: hasMinRole(role, ERT.member),
      canManageApiKeys: has(`apiKey:manage`),
      canInviteUsers: has(`invitation:create`),
      canAccessSecretValues: has(`secret:manage`),
      canRead: (r: EPermResource) => has(`${r}:read`),
      canExec: (r: EPermResource) => has(`${r}:exec`),
      isOwner: role === ERT.owner || role === ERT.super,
      canCreate: (r: EPermResource) => has(`${r}:create`),
      canUpdate: (r: EPermResource) => has(`${r}:update`),
      canDelete: (r: EPermResource) => has(`${r}:delete`),
      canManage: (r: EPermResource) => has(`${r}:manage`),
      canConnect: (r: EPermResource) => has(`${r}:connect`),
      canAssignRole: (target: ERoleType) => canManageRole(role, target),
    }
  }, [role, overrides, serverPermissions])
}

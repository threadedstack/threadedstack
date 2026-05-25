import type { TUsePermissions } from '@TSC/types'
import type {
  EPermResource,
  ERoleType,
  TPermission,
  PermissionOverride,
} from '@tdsk/domain'

import { useMemo } from 'react'
import { EmptyPermissions } from '@TSC/constants/values'
import {
  hasMinRole,
  canManageRole,
  ERoleType as ERT,
  resolvePermissions,
  buildRolePermissions,
} from '@tdsk/domain'

export const usePermissions = (
  role: ERoleType | null,
  overrides?: PermissionOverride[]
): TUsePermissions => {
  return useMemo((): TUsePermissions => {
    if (!role) return EmptyPermissions

    const permissions = overrides?.length
      ? resolvePermissions(role, overrides)
      : new Set<TPermission>(buildRolePermissions(role))

    const has = (perm: TPermission) => {
      if (role === ERT.super) return true
      return permissions.has(perm)
    }

    return {
      has,
      role,
      permissions,
      isSuper: role === ERT.super,
      isAdmin: hasMinRole(role, ERT.admin),
      isMember: hasMinRole(role, ERT.member),
      isOwner: role === ERT.owner || role === ERT.super,
      canRead: (r: EPermResource) => has(`${r}:read`),
      canExec: (r: EPermResource) => has(`${r}:exec`),
      canCreate: (r: EPermResource) => has(`${r}:create`),
      canUpdate: (r: EPermResource) => has(`${r}:update`),
      canDelete: (r: EPermResource) => has(`${r}:delete`),
      canManage: (r: EPermResource) => has(`${r}:manage`),
      canConnect: (r: EPermResource) => has(`${r}:connect`),
      canDeleteOrg: has(`org:delete`),
      canManageMembers: has(`org:manage`),
      canManageApiKeys: has(`apiKey:manage`),
      canInviteUsers: has(`invitation:create`),
      canAccessSecretValues: has(`secret:manage`),
      canAssignRole: (target: ERoleType) => canManageRole(role, target),
    }
  }, [role, overrides])
}

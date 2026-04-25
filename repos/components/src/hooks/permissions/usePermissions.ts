import type { TUsePermissions } from '@TSC/types'
import type { EPermResource, ERoleType } from '@tdsk/domain'

import { useMemo } from 'react'
import {
  canPerform,
  hasMinRole,
  isSuperAdmin,
  EPermAction,
  canManageRole,
  ERoleType as ERT,
  EPermResource as EPR,
  canAccessSecretValue,
} from '@tdsk/domain'

export const usePermissions = (role: ERoleType | null): TUsePermissions => {
  return useMemo((): TUsePermissions => {
    const check = (action: EPermAction, resource: EPermResource) =>
      canPerform(role, action, resource).allowed

    return {
      role,
      isSuper: isSuperAdmin(role),
      isOwner: hasMinRole(role, ERT.owner),
      isAdmin: hasMinRole(role, ERT.admin),
      isMember: hasMinRole(role, ERT.member),
      isViewer: hasMinRole(role, ERT.viewer),
      canDeleteOrg: check(EPermAction.delete, EPR.org),
      canAccessSecretValues: canAccessSecretValue(role),
      canInviteUsers: check(EPermAction.create, EPR.user),
      canManageMembers: check(EPermAction.manage, EPR.org),
      canManageApiKeys: check(EPermAction.create, EPR.apiKey),
      canRead: (resource) => check(EPermAction.read, resource),
      canExec: (resource) => check(EPermAction.exec, resource),
      canUpdate: (resource) => check(EPermAction.update, resource),
      canDelete: (resource) => check(EPermAction.delete, resource),
      canManage: (resource) => check(EPermAction.manage, resource),
      canCreate: (resource) => check(EPermAction.create, resource),
      canAssignRole: (targetRole) => canManageRole(role, targetRole),
    }
  }, [role])
}

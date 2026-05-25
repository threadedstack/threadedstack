import type { EPermResource, ERoleType, TPermission } from '@tdsk/domain'

export type TUsePermissions = {
  role: ERoleType | null
  isSuper: boolean
  isOwner: boolean
  isAdmin: boolean
  isMember: boolean
  canDeleteOrg: boolean
  canInviteUsers: boolean
  canManageMembers: boolean
  canManageApiKeys: boolean
  permissions: Set<TPermission>
  canAccessSecretValues: boolean
  has: (permission: TPermission) => boolean
  canRead: (resource: EPermResource) => boolean
  canExec: (resource: EPermResource) => boolean
  canUpdate: (resource: EPermResource) => boolean
  canCreate: (resource: EPermResource) => boolean
  canDelete: (resource: EPermResource) => boolean
  canManage: (resource: EPermResource) => boolean
  canConnect: (resource: EPermResource) => boolean
  canAssignRole: (targetRole: ERoleType) => boolean
}

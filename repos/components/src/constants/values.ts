import type { TPermission } from '@tdsk/domain'
import type { TUsePermissions } from '@TSC/types'

export const AuthorBoxWidth = 26
export const FeedbackIconSize = 16
export const DrawerDefaultWidth = 400

// Set this to the maximum number of lines to display before collapsing
export const CollapseMinLines = 25
// Set this to the maximum number of characters to display before collapsing
export const CollapseMinLength = 3000

export const CSSColorGlobals = [
  `unset`,
  `inherit`,
  `initial`,
  `revert`,
  `currentcolor`,
  `currentColor`,
  `revert-layer`,
]

export const CSSMuiColors = [
  `primary`,
  `secondary`,
  `success`,
  `error`,
  `info`,
  `warning`,
  `textPrimary`,
  `textSecondary`,
  `textDisabled`,
]

export const CSSColorRefs = [`#`, `rgba`, `hsl`, `hwb`]

export const EmptyPermissions: TUsePermissions = {
  role: null,
  isSuper: false,
  isOwner: false,
  isAdmin: false,
  isMember: false,
  has: () => false,
  canDeleteOrg: false,
  canInviteUsers: false,
  canManageMembers: false,
  canManageApiKeys: false,
  canAccessSecretValues: false,
  permissions: new Set<TPermission>(),
  canRead: () => false,
  canExec: () => false,
  canUpdate: () => false,
  canCreate: () => false,
  canDelete: () => false,
  canManage: () => false,
  canConnect: () => false,
  canAssignRole: () => false,
}

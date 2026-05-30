import type { TUsePermissions } from '@tdsk/components'

import { ERoleType, isValidRoleType } from '@tdsk/domain'
import { usePermissions as usePermissionsBase } from '@tdsk/components'
import {
  useUser,
  useActiveOrgRole,
  usePermissionOverrides,
  useActiveOrgResolvedPerms,
} from '@TTH/state/selectors'

export const usePermissions = (): TUsePermissions => {
  const [user] = useUser()
  const [activeOrgRole] = useActiveOrgRole()
  const [overrides] = usePermissionOverrides()
  const [resolvedPerms] = useActiveOrgResolvedPerms()
  const role: ERoleType | null =
    user?.role === ERoleType.super
      ? ERoleType.super
      : activeOrgRole && isValidRoleType(activeOrgRole)
        ? activeOrgRole
        : null

  return usePermissionsBase(role, overrides, resolvedPerms)
}

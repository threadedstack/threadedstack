import type { TUsePermissions } from '@tdsk/components'

import { ERoleType, isValidRoleType } from '@tdsk/domain'
import { useUser, useActiveOrgRole } from '@TTH/state/selectors'
import { usePermissions as usePermissionsBase } from '@tdsk/components'

export const usePermissions = (): TUsePermissions => {
  const [user] = useUser()
  const [activeOrgRole] = useActiveOrgRole()
  const role: ERoleType | null =
    user?.role === `super`
      ? ERoleType.super
      : activeOrgRole && isValidRoleType(activeOrgRole)
        ? activeOrgRole
        : null

  return usePermissionsBase(role)
}

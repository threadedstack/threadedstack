import type { TUsePermissions } from '@tdsk/components'

import { resolveRole } from '@TAF/utils/permissions/resolveRole'
import { useUser, useActiveOrgRole } from '@TAF/state/selectors'
import { usePermissions as usePermissionsBase } from '@tdsk/components'

export const usePermissions = (): TUsePermissions => {
  const [user] = useUser()
  const [activeOrgRole] = useActiveOrgRole()
  return usePermissionsBase(resolveRole(user?.role, activeOrgRole))
}

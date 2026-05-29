import type { TUsePermissions } from '@tdsk/components'

import { resolveRole } from '@TAF/utils/permissions/resolveRole'
import { usePermissions as usePermissionsBase } from '@tdsk/components'
import {
  useUser,
  useActiveOrgRole,
  usePermissionOverrides,
  useActiveOrgResolvedPerms,
} from '@TAF/state/selectors'

export const usePermissions = (): TUsePermissions => {
  const [user] = useUser()
  const [activeOrgRole] = useActiveOrgRole()
  const [overrides] = usePermissionOverrides()
  const [resolvedPerms] = useActiveOrgResolvedPerms()
  return usePermissionsBase(
    resolveRole(user?.role, activeOrgRole),
    overrides,
    resolvedPerms
  )
}

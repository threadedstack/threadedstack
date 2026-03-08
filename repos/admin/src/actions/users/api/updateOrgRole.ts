import type { TRoleType } from '@tdsk/domain'

import { usersApi } from '@TAF/services/usersApi'
import { updateOrgUserRole } from '@TAF/actions/users/local/updateOrgUserRole'

export const updateOrgRole = async (
  orgId: string,
  userId: string,
  roleType: TRoleType
) => {
  // TODO: add client-side UX to disable role changes for non-admin+ users
  // Server enforces permission checks; this would improve UX by hiding the option
  const resp = await usersApi.updateRole(orgId, userId, roleType)
  if (resp.error) return { error: resp.error }

  updateOrgUserRole(orgId, userId, roleType)

  return resp
}

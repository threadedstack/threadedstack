import type { TRoleType } from '@tdsk/domain'
import { usersApi } from '@TAF/services/usersApi'

export const inviteToOrg = async (orgId: string, email: string, roleType: TRoleType) => {
  // TODO: add client-side UX to disable invite for non-admin users
  // Server enforces permission checks; this would improve UX by hiding the option
  const resp = await usersApi.inviteToOrg(orgId, {
    roleType,
    email: email.trim(),
  })

  return resp
}

import type { TRoleType } from '@tdsk/domain'
import { usersApi } from '@TAF/services/usersApi'

export const inviteToOrg = async (orgId: string, email: string, role: TRoleType) => {
  // TODO: add permissions to check if current user is admin
  // Only admin users can invite user to an organization
  const resp = await usersApi.inviteToOrg(orgId, {
    email: email.trim(),
    role,
  })

  return resp
}

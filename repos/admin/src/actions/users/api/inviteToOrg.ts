import type { TRoleType } from '@tdsk/domain'

import { query } from '@TAF/services/query'
import { usersApi } from '@TAF/services/usersApi'
import { listOrgUsers } from '@TAF/actions/users/api/listOrgUsers'

export const inviteToOrg = async (orgId: string, email: string, roleType: TRoleType) => {
  // TODO: add client-side UX to disable invite for non-admin users
  // Server enforces permission checks; see InviteUserDrawer.tsx to conditionally render based on role
  const resp = await usersApi.inviteToOrg(orgId, {
    roleType,
    email: email.trim(),
  })

  // TODO: Validate if this is needed. It should not be
  // Update local users store with a user object that has been invited
  if (!resp.error) {
    query.client.removeQueries({ queryKey: usersApi.cache.listOrg(orgId) })
    const refreshResp = await listOrgUsers(orgId)
    if (refreshResp.error)
      console.warn('[inviteToOrg] Failed to refresh user list:', refreshResp.error)
  }

  return resp
}

import type { TRoleType } from '@tdsk/domain'
import type { TProjectRules, TPermissionOverrides } from '@tdsk/domain'

import { query } from '@TAF/services/query'
import { usersApi } from '@TAF/services/usersApi'
import { listOrgUsers } from '@TAF/actions/users/api/listOrgUsers'

export const inviteToOrg = async (
  orgId: string,
  email: string,
  roleType: TRoleType,
  projectRoles?: TProjectRules,
  permissionOverrides?: TPermissionOverrides
) => {
  const resp = await usersApi.inviteToOrg(orgId, {
    roleType,
    email: email.trim(),
    ...(projectRoles?.length && { projectRoles }),
    ...(permissionOverrides?.length && { permissionOverrides }),
  })

  // TODO: Validate if this is needed. It should not be
  // Update local users store with a user object that has been invited
  if (!resp.error) {
    query.client.removeQueries({ queryKey: usersApi.cache.listOrg(orgId) })
    const refreshResp = await listOrgUsers(orgId)
    if (refreshResp.error)
      console.warn(`[inviteToOrg] Failed to refresh user list:`, refreshResp.error)
  }

  return resp
}

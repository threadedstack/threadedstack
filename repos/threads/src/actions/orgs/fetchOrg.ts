import type { TPermission, Organization } from '@tdsk/domain'

import { orgsApi } from '@TTH/services/orgsApi'
import { setActiveOrgResolvedPerms } from '@TTH/state/accessors'

type TOrgWithPerms = Organization & { resolvedPermissions?: TPermission[] | `super` }

export const fetchOrg = async (orgId: string) => {
  const resp = await orgsApi.get(orgId)
  if (resp.error) return { error: resp.error }
  if (resp.data) {
    const perms = (resp.data as TOrgWithPerms).resolvedPermissions
    if (perms !== undefined) setActiveOrgResolvedPerms(perms)
  }
  return resp
}

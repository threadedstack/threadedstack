import type { TPermission, Organization } from '@tdsk/domain'

import { isValidRoleType } from '@tdsk/domain'
import { orgsApi } from '@TTH/services/orgsApi'
import {
  getOrgId,
  setActiveOrgRole,
  setActiveOrgResolvedPerms,
} from '@TTH/state/accessors'

type TOrgWithPerms = Organization & {
  userRole?: string
  resolvedPermissions?: TPermission[] | `super`
}

export const fetchOrg = async (orgId: string) => {
  const resp = await orgsApi.get(orgId)
  if (resp.error) return { error: resp.error }
  if (resp.data) {
    const detail = resp.data as TOrgWithPerms
    if (detail.resolvedPermissions !== undefined)
      setActiveOrgResolvedPerms(detail.resolvedPermissions)

    // The org detail response includes the caller's role — set it for the
    // active org. The paginated org LIST may not contain the active org
    // (e.g. super users with many orgs), so the role cannot be derived
    // from the list alone.
    if (detail.userRole && isValidRoleType(detail.userRole) && getOrgId() === orgId)
      setActiveOrgRole(detail.userRole)
  }
  return resp
}

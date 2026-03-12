import type { TRoleType } from '@tdsk/domain'

import { User } from '@tdsk/domain'
import { getOrgUsers, setOrgUsers } from '@TAF/state/accessors'

export const updateOrgUserRole = (orgId: string, userId: string, roleType: TRoleType) => {
  const all = getOrgUsers() || {}
  const orgUsers = all[orgId] || []
  const updated = orgUsers.map((u) =>
    u.id !== userId ? u : new User({ ...u, role: roleType })
  )
  setOrgUsers({ ...all, [orgId]: updated })
}

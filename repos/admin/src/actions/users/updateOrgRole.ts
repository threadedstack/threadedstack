import type { TRoleType } from '@tdsk/domain'

import { User } from '@tdsk/domain'
import { usersApi } from '@TAF/services/usersApi'
import { setOrgUsers, getOrgUsers } from '@TAF/state/accessors'

export const updateOrgRole = async (
  orgId: string,
  userId: string,
  roleType: TRoleType
) => {
  // TODO: add client-side UX to disable role changes for non-admin+ users
  // Server enforces permission checks; this would improve UX by hiding the option
  const { error, data } = await usersApi.updateRole(orgId, userId, roleType)
  if (error) return { error }

  const allUsers = getOrgUsers()
  const orgUsers = allUsers?.[orgId]
  if (!orgUsers?.length) return { data }

  const updated = orgUsers.map((usr) =>
    usr.id !== userId ? usr : new User({ ...usr, role: roleType })
  )
  setOrgUsers({ ...allUsers, [orgId]: updated })

  return { data }
}

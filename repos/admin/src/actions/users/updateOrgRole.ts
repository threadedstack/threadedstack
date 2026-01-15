import type { TRoleType } from '@tdsk/domain'

import { User } from '@tdsk/domain'
import { usersApi } from '@TAF/services/usersApi'
import { setOrgUsers, getOrgUsers } from '@TAF/state/accessors'

export const updateOrgRole = async (orgId: string, userId: string, role: TRoleType) => {
  // TODO: add permissions to check if current user is super-admin
  // Only super-admin users can update roles for other users in organizations
  const { error, data } = await usersApi.updateRole(orgId, userId, role)
  if (error) return { error }

  const allUsers = getOrgUsers()
  const orgUsers = allUsers?.[orgId]
  if (!orgUsers?.length) return { data }

  const updated = orgUsers.map((usr) =>
    usr.id !== userId ? usr : new User({ ...usr, role })
  )
  setOrgUsers({ ...allUsers, [orgId]: updated })

  return { data }
}

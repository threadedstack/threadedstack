import { usersApi } from '@TAF/services/usersApi'
import { setOrgUsers, getOrgUsers } from '@TAF/state/accessors'

export const removeFromOrg = async (orgId: string, userId: string) => {
  const { data, error } = await usersApi.removeFromOrg(orgId, userId)
  if (error) return { error }

  const allUsers = getOrgUsers()
  const orgUsers = allUsers?.[orgId]
  if (!orgUsers?.length) return { data }

  const filtered = orgUsers.filter((usr) => usr.id !== userId)
  setOrgUsers({ ...allUsers, [orgId]: filtered })

  return { data }
}

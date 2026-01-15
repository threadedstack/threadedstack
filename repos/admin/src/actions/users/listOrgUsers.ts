import { usersApi } from '@TAF/services/usersApi'
import { setOrgUsers, getOrgUsers } from '@TAF/state/accessors'

export const listOrgUsers = async (orgId: string) => {
  const { error, data } = await usersApi.listByOrg(orgId)
  if (error) return { error }

  if (data) {
    const allUsers = getOrgUsers()
    setOrgUsers({ ...allUsers, [orgId]: data })
  }

  return { data }
}

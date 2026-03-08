import { usersApi } from '@TAF/services/usersApi'
import { removeOrgUser } from '@TAF/actions/users/local/removeOrgUser'

export const removeFromOrg = async (orgId: string, userId: string) => {
  const resp = await usersApi.removeFromOrg(orgId, userId)
  if (resp.error) return { error: resp.error }
  removeOrgUser(orgId, userId)
  return resp
}

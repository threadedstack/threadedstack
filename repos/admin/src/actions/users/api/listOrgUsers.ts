import { usersApi } from '@TAF/services/usersApi'
import { setOrgUsers } from '@TAF/actions/users/local/setOrgUsers'

export const listOrgUsers = async (orgId: string) => {
  const resp = await usersApi.listByOrg(orgId)
  if (resp.error) return { error: resp.error }
  resp.data && setOrgUsers(orgId, resp.data)

  return resp
}

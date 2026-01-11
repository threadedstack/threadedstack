import { orgsApi } from '@TAF/services'
import { setOrgs } from '@TAF/state/accessors'

export const fetchOrgs = async () => {
  const resp = await orgsApi.list()

  if (resp.error) return { error: resp.error }

  resp.data && setOrgs(resp.data)
  return resp
}

import { domainsApi } from '@TAF/services'
import { upsertDomain } from '@TAF/actions/domains/local/upsertDomain'

export const fetchDomain = async (id: string) => {
  const resp = await domainsApi.get(id)
  resp.data && upsertDomain(resp.data)

  return resp
}

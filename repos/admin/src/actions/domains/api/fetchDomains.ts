import { domainsApi } from '@TAF/services'
import { setDomains } from '@TAF/actions/domains/local/setDomains'

export type TFetchDomainsOpts = {
  orgId: string
  projectId?: string
}

export const fetchDomains = async (opts: TFetchDomainsOpts) => {
  const { orgId, projectId } = opts
  const resp = await domainsApi.list(orgId, projectId)

  if (resp.error) return resp

  const contextKey = projectId || `org`
  resp.data && setDomains(contextKey, resp.data)

  return resp
}

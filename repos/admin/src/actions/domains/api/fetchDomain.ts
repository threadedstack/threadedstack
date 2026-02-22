import { domainsApi } from '@TAF/services'
import { upsertDomain } from '@TAF/actions/domains/local/upsertDomain'

export type TFetchDomainOpts = {
  orgId: string
  id: string
  projectId?: string
}

export const fetchDomain = async (opts: TFetchDomainOpts) => {
  const { orgId, id, projectId } = opts
  const resp = await domainsApi.get(orgId, id, projectId)
  const contextKey = projectId || 'org'
  resp.data && upsertDomain(contextKey, resp.data)

  return resp
}

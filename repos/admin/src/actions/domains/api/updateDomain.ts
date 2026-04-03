import type { Domain } from '@tdsk/domain'
import { domainsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertDomain } from '@TAF/actions/domains/local/upsertDomain'

export type TUpdateDomainOpts = {
  orgId: string
  id: string
  data: Partial<Domain>
  projectId?: string
}

export const updateDomain = async (opts: TUpdateDomainOpts) => {
  const { orgId, id, data, projectId } = opts
  const resp = await domainsApi.update(orgId, id, data, projectId)

  if (resp.error) return resp
  const contextKey = projectId || 'org'
  resp.data && upsertDomain(contextKey, resp.data)
  resp.data && query.upsertListCache(domainsApi.cache.list(orgId, contextKey), resp.data)
  resp.data && query.updateDetailCache(domainsApi.cache.detail(id), resp.data)

  return resp
}

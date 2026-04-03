import type { Endpoint } from '@tdsk/domain'
import { endpointsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertEndpoint } from '@TAF/actions/endpoints/local/upsertEndpoint'

export type TUpdateEndpointOpts = {
  orgId: string
  projectId: string
  id: string
  data: Partial<Endpoint>
}

export const updateEndpoint = async (opts: TUpdateEndpointOpts) => {
  const { orgId, projectId, id, data } = opts
  const resp = await endpointsApi.update(orgId, projectId, id, data)

  if (resp.error) return { error: resp.error }
  resp.data && upsertEndpoint(projectId, resp.data)
  resp.data && query.upsertListCache(endpointsApi.cache.list(orgId, projectId), resp.data)
  resp.data && query.updateDetailCache(endpointsApi.cache.detail(id), resp.data)

  return resp
}

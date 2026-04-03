import type { Endpoint } from '@tdsk/domain'
import { endpointsApi } from '@TAF/services'
import { query } from '@TAF/services/query'
import { upsertEndpoint } from '@TAF/actions/endpoints/local/upsertEndpoint'

export type TCreateEndpointOpts = {
  orgId: string
  projectId: string
  data: Partial<Endpoint>
}

export type TCreateEndpointResult = {
  data?: Endpoint
  error?: Error
}

export const createEndpoint = async (opts: TCreateEndpointOpts) => {
  const { orgId, projectId, data } = opts
  const resp = await endpointsApi.create(orgId, projectId, data)

  if (resp.error) return { error: resp.error }
  resp.data && upsertEndpoint(projectId, resp.data)
  resp.data && query.upsertListCache(endpointsApi.cache.list(orgId, projectId), resp.data)

  return resp
}

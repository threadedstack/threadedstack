import type { Endpoint } from '@tdsk/domain'
import { endpointsApi } from '@TAF/services'
import { setEndpoints } from '@TAF/actions/endpoints/local/setEndpoints'

export type TFetchEndpointsOpts = {
  orgId: string
  projectId: string
}

export type TFetchEndpointsResult = {
  endpoints?: Record<string, Endpoint>
  error?: Error
}

export const fetchEndpoints = async (opts: TFetchEndpointsOpts) => {
  const { orgId, projectId } = opts
  const resp = await endpointsApi.list(orgId, projectId)

  if (resp.error) return { error: resp.error }

  resp.data && setEndpoints(projectId, resp.data)

  return resp
}

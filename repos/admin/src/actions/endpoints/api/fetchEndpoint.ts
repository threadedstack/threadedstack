import { endpointsApi } from '@TAF/services'
import { upsertEndpoint } from '@TAF/actions/endpoints/local/upsertEndpoint'

export type TFetchEndpointOpts = {
  orgId: string
  projectId: string
  id: string
}

export const fetchEndpoint = async (opts: TFetchEndpointOpts) => {
  const { orgId, projectId, id } = opts
  const resp = await endpointsApi.get(orgId, projectId, id)
  if (resp.error) return { error: resp.error }
  resp.data && upsertEndpoint(projectId, resp.data)

  return resp
}

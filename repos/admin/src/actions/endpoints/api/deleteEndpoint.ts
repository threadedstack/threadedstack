import { endpointsApi } from '@TAF/services'
import { removeEndpoint } from '@TAF/actions/endpoints/local/removeEndpoint'

export type TDeleteEndpointOpts = {
  orgId: string
  projectId: string
  id: string
}

export const deleteEndpoint = async (opts: TDeleteEndpointOpts) => {
  const { orgId, projectId, id } = opts
  const resp = await endpointsApi.delete(orgId, projectId, id)
  if (resp.error) return { error: resp.error }
  removeEndpoint(id)

  return resp
}

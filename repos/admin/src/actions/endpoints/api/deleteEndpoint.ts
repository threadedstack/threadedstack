import { endpointsApi } from '@TAF/services'
import { removeEndpoint } from '@TAF/actions/endpoints/local/removeEndpoint'

export const deleteEndpoint = async (id: string) => {
  const resp = await endpointsApi.delete(id)
  if (resp.error) return { error: resp.error }
  removeEndpoint(id)

  return resp
}

import { endpointsApi } from '@TAF/services'
import { setEndpoints, getEndpoints } from '@TAF/state/accessors'

export type TDeleteEndpointResult = {
  success?: boolean
  error?: Error
}

export const deleteEndpoint = async (id: string): Promise<TDeleteEndpointResult> => {
  const resp = await endpointsApi.delete(id)

  if (resp.error) {
    return { error: resp.error }
  }

  // Remove endpoint from state
  const currentEndpoints = getEndpoints() || {}
  const { [id]: removed, ...remainingEndpoints } = currentEndpoints
  setEndpoints(remainingEndpoints)

  return { success: true }
}

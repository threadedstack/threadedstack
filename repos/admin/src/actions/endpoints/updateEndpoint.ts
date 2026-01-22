import type { Endpoint } from '@tdsk/domain'

import { endpointsApi } from '@TAF/services'
import { setEndpoints, getEndpoints } from '@TAF/state/accessors'

export type TUpdateEndpointResult = {
  data?: Endpoint
  error?: Error
}

export const updateEndpoint = async (
  id: string,
  ep: Partial<Endpoint>
): Promise<TUpdateEndpointResult> => {
  const resp = await endpointsApi.update(id, ep)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    // Update endpoints state with the updated endpoint
    const currentEndpoints = getEndpoints() || {}
    setEndpoints({ ...currentEndpoints, [resp.data.id]: resp.data })
  }

  return resp
}

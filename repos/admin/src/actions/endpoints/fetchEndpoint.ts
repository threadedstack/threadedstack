import type { Endpoint } from '@tdsk/domain'

import { endpointsApi } from '@TAF/services'
import { setEndpoints, getEndpoints } from '@TAF/state/accessors'

export type TFetchEndpointResult = {
  endpoint?: Endpoint
  error?: Error
}

export const fetchEndpoint = async (id: string): Promise<TFetchEndpointResult> => {
  const resp = await endpointsApi.get(id)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update endpoints state with the fetched endpoint
    const currentEndpoints = getEndpoints() || {}
    setEndpoints({ ...currentEndpoints, [resp.data.id]: resp.data })
  }

  return { endpoint: resp.data }
}

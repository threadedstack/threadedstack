import type { Endpoint } from '@tdsk/domain'

import { endpointsApi } from '@TAF/services'
import { setEndpoints, getEndpoints } from '@TAF/state/accessors'

export type TUpdateEndpointInput = {
  name?: string
  path?: string
  method?: string
  description?: string
  config?: Record<string, any>
}

export type TUpdateEndpointResult = {
  endpoint?: Endpoint
  error?: Error
}

export const updateEndpoint = async (
  id: string,
  input: TUpdateEndpointInput
): Promise<TUpdateEndpointResult> => {
  const resp = await endpointsApi.update(id, input)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update endpoints state with the updated endpoint
    const currentEndpoints = getEndpoints() || {}
    setEndpoints({ ...currentEndpoints, [resp.data.id]: resp.data })
  }

  return { endpoint: resp.data }
}

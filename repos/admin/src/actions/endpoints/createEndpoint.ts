import type { Endpoint } from '@tdsk/domain'

import { endpointsApi } from '@TAF/services'
import { setEndpoints, getEndpoints } from '@TAF/state/accessors'

export type TCreateEndpointInput = {
  name: string
  path: string
  method: string
  projectId: string
  description?: string
  config?: Record<string, any>
}

export type TCreateEndpointResult = {
  endpoint?: Endpoint
  error?: Error
}

export const createEndpoint = async (
  input: TCreateEndpointInput
): Promise<TCreateEndpointResult> => {
  const resp = await endpointsApi.create(input)

  if (resp.error) {
    return { error: resp.error }
  }

  if (resp.data) {
    // Update endpoints state with the new endpoint
    const currentEndpoints = getEndpoints() || {}
    setEndpoints({ ...currentEndpoints, [resp.data.id]: resp.data })
  }

  return { endpoint: resp.data }
}

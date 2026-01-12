import type { Endpoint } from '@tdsk/domain'

import { endpointsApi } from '@TAF/services'
import { setEndpoints } from '@TAF/state/accessors'

export type TFetchEndpointsResult = {
  endpoints?: Record<string, Endpoint>
  error?: Error
}

export const fetchEndpoints = async (filters?: {
  projectId?: string
}): Promise<TFetchEndpointsResult> => {
  const resp = await endpointsApi.list(filters)

  if (resp.error) {
    return { error: resp.error }
  }

  const endpointsMap =
    resp.data?.reduce((acc: Record<string, Endpoint>, endpoint: Endpoint) => {
      acc[endpoint.id] = endpoint
      return acc
    }, {}) || {}

  setEndpoints(endpointsMap)
  return { endpoints: endpointsMap }
}

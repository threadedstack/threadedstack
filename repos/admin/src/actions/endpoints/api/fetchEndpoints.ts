import type { Endpoint } from '@tdsk/domain'

import { endpointsApi } from '@TAF/services'
import { upsertEndpoints } from '@TAF/actions/endpoints/local/upsertEndpoints'

export type TFetchEndpointsResult = {
  endpoints?: Record<string, Endpoint>
  error?: Error
}

export const fetchEndpoints = async (filters?: { projectId?: string }) => {
  const resp = await endpointsApi.list(filters)

  if (resp.error) return { error: resp.error }
  resp.data && upsertEndpoints(resp.data)

  return resp
}

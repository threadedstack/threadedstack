import type { Endpoint } from '@tdsk/domain'

import { endpointsApi } from '@TAF/services'
import { upsertEndpoint } from '@TAF/actions/endpoints/local/upsertEndpoint'

export type TCreateEndpointInput = {
  name: string
  path: string
  method: string
  projectId: string
  description?: string
  config?: Record<string, any>
  options?: Record<string, any>
  headers?: Record<string, string>
}

export type TCreateEndpointResult = {
  data?: Endpoint
  error?: Error
}

export const createEndpoint = async (ep: Partial<Endpoint>) => {
  const resp = await endpointsApi.create(ep)

  if (resp.error) return { error: resp.error }
  resp.data && upsertEndpoint(resp.data)

  return resp
}

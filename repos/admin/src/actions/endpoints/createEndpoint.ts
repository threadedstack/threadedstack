import type { Endpoint } from '@tdsk/domain'

import { endpointsApi } from '@TAF/services'
import { setEndpoints, getEndpoints } from '@TAF/state/accessors'

export type TCreateEndpointInput = {
  name: string
  path: string
  method: string
  projectId: string
  description?: string
  options?: Record<string, any>
  config?: Record<string, any>
  headers?: Record<string, string>
}

export type TCreateEndpointResult = {
  data?: Endpoint
  error?: Error
}

export const createEndpoint = async (
  ep: Partial<Endpoint>
): Promise<TCreateEndpointResult> => {
  const resp = await endpointsApi.create(ep)

  if (resp.error) return { error: resp.error }

  if (resp.data) {
    const endpoints = getEndpoints() || {}
    setEndpoints({ ...endpoints, [resp.data.id]: resp.data })
  }

  return resp
}

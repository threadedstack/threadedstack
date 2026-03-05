import type { TEndpointTestRes } from '@TAF/services/endpointTestApi'
import { endpointTestApi } from '@TAF/services'

export type TTestEndpointOpts = {
  body?: string
  method: string
  projectId: string
  endpointId: string
  headers?: Record<string, string>
  queryParams?: Record<string, string>
}

export const testEndpoint = async (
  opts: TTestEndpointOpts
): Promise<TEndpointTestRes> => {
  const { body, method, headers, projectId, endpointId, queryParams } = opts

  return endpointTestApi.execute(projectId, endpointId, {
    body,
    method,
    headers,
    queryParams,
  })
}

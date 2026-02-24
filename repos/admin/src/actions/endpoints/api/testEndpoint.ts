import type { TEndpointTestRes } from '@TAF/services/endpointTestApi'
import { endpointTestApi } from '@TAF/services'

export type TTestEndpointOpts = {
  projectId: string
  endpointId: string
  method: string
  headers?: Record<string, string>
  body?: string
}

export const testEndpoint = async (
  opts: TTestEndpointOpts
): Promise<TEndpointTestRes> => {
  const { projectId, endpointId, method, headers, body } = opts

  return endpointTestApi.execute(projectId, endpointId, {
    method,
    headers,
    body,
  })
}

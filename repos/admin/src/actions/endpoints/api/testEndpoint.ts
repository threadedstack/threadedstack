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
  const { projectId, endpointId, ...params } = opts
  return endpointTestApi.execute(projectId, endpointId, params)
}

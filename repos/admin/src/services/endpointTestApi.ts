import { BaseApi } from '@TAF/services/api'
import { apiUrl } from '@TAF/utils/api/apiUrl'

export type TEndpointTestResult = {
  status: number
  statusText: string
  body: string
  contentType: string
  timing: number
}

export type TEndpointTestOpts = {
  method: string
  headers?: Record<string, string>
  body?: string
}

export type TEndpointTestRes = {
  data?: TEndpointTestResult
  error?: Error
}

export class EndpointTestApi extends BaseApi {
  async execute(
    projectId: string,
    endpointId: string,
    opts: TEndpointTestOpts
  ): Promise<TEndpointTestRes> {
    const { method, headers = {}, body } = opts
    const baseUrl = apiUrl({}).replace(/\/$/, ``)
    const url = `${baseUrl}/proxy/${projectId}/${endpointId}`

    // Read auth headers from the shared apiService instance
    const authHeaders: Record<string, string> = {}
    const authHeader = this.api.options.headers?.Authorization
    if (authHeader) authHeaders.Authorization = authHeader

    const start = performance.now()

    try {
      const res = await fetch(url, {
        method,
        headers: { ...authHeaders, ...headers },
        body: body || undefined,
      })

      const timing = Math.round(performance.now() - start)
      const contentType = res.headers.get(`content-type`) || `text/plain`
      const responseBody = await res.text()

      return {
        data: {
          status: res.status,
          statusText: res.statusText,
          body: responseBody,
          contentType,
          timing,
        },
      }
    } catch (err) {
      return {
        error: err instanceof Error ? err : new Error(String(err)),
      }
    }
  }
}

export const endpointTestApi = new EndpointTestApi()

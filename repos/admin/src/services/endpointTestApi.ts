import { BaseApi } from '@TAF/services/api'
import { apiUrl } from '@TAF/utils/api/apiUrl'

export type TEndpointTestResult = {
  body: string
  timing: number
  status: number
  statusText: string
  contentType: string
}

export type TEndpointTestOpts = {
  body?: string
  method: string
  headers?: Record<string, string>
  queryParams?: Record<string, string>
}

export type TEndpointTestRes = {
  error?: Error
  data?: TEndpointTestResult
}

export class EndpointTestApi extends BaseApi {
  async execute(
    projectId: string,
    endpointId: string,
    opts: TEndpointTestOpts
  ): Promise<TEndpointTestRes> {
    const { method, headers = {}, body, queryParams } = opts
    const baseUrl = apiUrl({}).replace(/\/$/, ``)
    let url = `${baseUrl}/proxy/${projectId}/${endpointId}`

    if (queryParams && Object.keys(queryParams).length) {
      const params = new URLSearchParams(queryParams)
      url = `${url}?${params.toString()}`
    }

    // Read auth headers from the shared apiService instance
    const authHeaders: Record<string, string> = {}
    const authHeader = this.api.headers?.Authorization
    if (authHeader) authHeaders.Authorization = authHeader

    const start = performance.now()

    try {
      const res = await fetch(url, {
        method,
        body: body || undefined,
        headers: { ...authHeaders, ...headers },
      })

      const timing = Math.round(performance.now() - start)
      const contentType = res.headers.get(`content-type`) || `text/plain`
      const responseBody = await res.text()

      return {
        data: {
          timing,
          contentType,
          status: res.status,
          body: responseBody,
          statusText: res.statusText,
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

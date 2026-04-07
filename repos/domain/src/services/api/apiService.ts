import type { TApiConfig, TApiRequest, TApiResponse, TApiResponseObj } from '@TDM/types'

import { EApiMethod } from '@TDM/types'
import { isObj } from '@keg-hub/jsutils/isObj'
import { Exception } from '@TDM/error/exception'
import { objToQuery } from '@TDM/utils/api/objToQuery'
import { toFormData } from '@TDM/utils/api/toFormData'

export class ApiService {
  url: string
  basePath: string
  headers: Record<string, string>
  options: Omit<RequestInit, `body` | `headers` | `method`>

  constructor(config: TApiConfig) {
    this.url = config.url
    this.basePath = config.basePath ?? ``
    this.headers = { ...config.headers }
    this.options = { ...config.options }
  }

  setHeaders = (update: Record<string, string>, merge: boolean = true) => {
    this.headers = merge ? { ...this.headers, ...update } : { ...update }
  }

  setBearer = (token: string) => {
    this.headers = {
      ...this.headers,
      Authorization: `Bearer ${token}`,
    }
  }

  clearBearer = () => {
    const { Authorization, ...rest } = this.headers
    this.headers = rest
  }

  protected buildUrl(path: string = ``, params?: string | Record<string, any>): string {
    const baseClean = this.url.replace(/\/$/, ``)
    const pathParts = [baseClean]

    if (this.basePath) pathParts.push(this.basePath)
    if (path) pathParts.push(path.replace(/^\//, ``))

    const built = pathParts.join(`/`)

    if (!params) return built
    if (isObj(params)) return `${built}${objToQuery(params)}`
    return `${built}?${(params as string).replace(/^\?/, ``)}`
  }

  protected buildHeaders(
    requestHeaders?: Record<string, string>
  ): Record<string, string> {
    return { ...this.headers, ...requestHeaders }
  }

  protected buildBody(
    data: TApiRequest[`data`],
    form?: boolean
  ): string | FormData | undefined {
    if (data === undefined || data === null) return undefined
    if (form) return typeof data === `string` ? data : toFormData(data)
    return JSON.stringify(data)
  }

  protected buildError(message: string, status: number, text?: string): Exception {
    const statusText = text ? `Status: ${status} - ${text}` : ``
    const msg =
      [message, statusText].filter(Boolean).join(`\n`) ||
      `Request failed with status ${status}`
    return new Exception(status, msg)
  }

  protected buildFetchInit(opts: TApiRequest): { url: string; init: RequestInit } {
    const {
      data,
      path,
      form,
      method,
      timeout,
      error: _error,
      rawResponse: _rr,
      responseType: _rt,
      headers: reqHeaders,
      ...rest
    } = opts

    const isGet = method === EApiMethod.GET
    const url = this.buildUrl(path, isGet ? data : undefined)
    const headers = this.buildHeaders(reqHeaders)
    const body = isGet ? undefined : this.buildBody(data, form)

    const init: RequestInit = {
      ...this.options,
      ...rest,
      method,
      headers,
    }

    if (body !== undefined) init.body = body
    if (timeout != null) init.signal = AbortSignal.timeout(timeout)

    return { url, init }
  }

  protected async parseResponse<T>(
    res: Response,
    opts: TApiRequest
  ): Promise<TApiResponse<T>> {
    let parsed: any
    let parseError: Error | undefined
    try {
      parsed = opts.responseType === `text` ? await res.text() : await res.json()
    } catch (err: any) {
      parsed = null
      parseError = err
    }

    if (res.status >= 400) {
      const text =
        typeof parsed === `string`
          ? parsed
          : parsed
            ? JSON.stringify(parsed)
            : res.statusText || `Request failed`

      const error = this.buildError(opts.error || ``, res.status, text)
      if (parsed) error.details = parsed

      return {
        error,
        ok: false,
        status: res.status,
      }
    }

    if (parseError)
      return {
        ok: false,
        status: res.status,
        error: this.buildError(
          `Failed to parse response body: ${parseError.message}`,
          res.status
        ),
      }

    if (opts.rawResponse || !isObj(parsed) || !(`data` in parsed))
      return { ok: true, status: res.status, data: parsed as T }

    const { data, ...meta } = parsed
    const { ok: _ok, status: _status, error: _error, ...safeMeta } = meta
    return { ok: true, status: res.status, data: data as T, ...safeMeta }
  }

  protected async invoke<T>(opts: TApiRequest): Promise<TApiResponse<T>> {
    if (!this.url) {
      return {
        ok: false,
        status: 0,
        error: this.buildError(`ApiService: url is not configured`, 0),
      }
    }

    const { url, init } = this.buildFetchInit(opts)

    try {
      const res = await fetch(url, init)
      return await this.parseResponse<T>(res, opts)
    } catch (error: any) {
      return {
        ok: false,
        status: 0,
        error: this.buildError(error.message, 0),
      }
    }
  }

  stream = async (
    opts: TApiRequest & { method?: EApiMethod }
  ): Promise<TApiResponseObj> => {
    if (!this.url) {
      return {
        ok: false,
        status: 0,
        error: this.buildError(`ApiService: url is not configured`, 0),
      }
    }

    const method = opts.method || EApiMethod.POST
    const { url, init } = this.buildFetchInit({ ...opts, method })

    try {
      const res = await fetch(url, init)
      if (res.status >= 400) {
        const text = await res.text().catch(() => res.statusText || `Request failed`)
        return {
          ok: false,
          status: res.status,
          error: this.buildError(opts.error || ``, res.status, text),
        }
      }
      return { ok: true, status: res.status, response: res }
    } catch (error: any) {
      return {
        ok: false,
        status: 0,
        error: this.buildError(error.message, 0),
      }
    }
  }

  get = async <T = Record<string, any>>(opts: TApiRequest): Promise<TApiResponse<T>> => {
    return this.invoke<T>({ ...opts, method: EApiMethod.GET })
  }

  post = async <T = Record<string, any>>(opts: TApiRequest): Promise<TApiResponse<T>> => {
    return this.invoke<T>({ ...opts, method: EApiMethod.POST })
  }

  put = async <T = Record<string, any>>(opts: TApiRequest): Promise<TApiResponse<T>> => {
    return this.invoke<T>({ ...opts, method: EApiMethod.PUT })
  }

  delete = async <T = Record<string, any>>(
    opts: TApiRequest
  ): Promise<TApiResponse<T>> => {
    return this.invoke<T>({ ...opts, method: EApiMethod.DELETE })
  }

  patch = async <T = Record<string, any>>(
    opts: TApiRequest
  ): Promise<TApiResponse<T>> => {
    return this.invoke<T>({ ...opts, method: EApiMethod.PATCH })
  }
}

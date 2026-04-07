import type { TApiRequest, TApiResponse } from '@tdsk/domain'
import type { TApiReq, TApiData, TAuthData, TApiService } from '@TAF/types'

import { toast } from 'sonner'
import { query } from '@TAF/services/query'
import { isStr } from '@keg-hub/jsutils/isStr'
import { isObj } from '@keg-hub/jsutils/isObj'
import { apiUrl } from '@TAF/utils/api/apiUrl'
import { authClient } from '@TAF/services/auth'
import { tokenRefresh } from '@TAF/services/tokenRefresh'
import { objToQuery, ApiService as DomainApiService, EApiMethod } from '@tdsk/domain'

export class ApiService extends DomainApiService {
  path: string = `_`
  mock: typeof fetch

  constructor(cfg: TApiService = {}) {
    super({
      url: ``,
      headers: {
        Accept: `application/json`,
        [`Content-Type`]: `application/json`,
      },
    })
    this.configure(cfg)
  }

  bearer = async (auth?: TAuthData) => {
    if (!auth) {
      const { data } = await authClient.getSession()
      if (!data?.session?.token) {
        console.warn(
          `[ApiService.bearer] getSession returned no token — requests will be unauthenticated`
        )
        return
      }
      auth = data as TAuthData
    }

    if (!auth?.session?.token) {
      this.clearBearer()
      return
    }

    this.setBearer(auth.session.token)
  }

  configure = (cfg: TApiService = {}) => {
    const { url, path, options = {} } = cfg

    if (path) this.path = path
    this.url = apiUrl({ url })

    if (options.headers) this.setHeaders(options.headers)
  }

  protected buildUrl(path: string = ``, params?: string | Record<string, any>): string {
    const baseClean = this.url.replace(/\/$/, ``)
    const parts = [baseClean]

    if (this.path) parts.push(this.path)
    if (path) parts.push(path.replace(/^\//, ``))

    const built = parts.join(`/`)

    if (!params) return built
    if (isObj(params)) return `${built}${objToQuery(params)}`
    return `${built}?${(params as string).replace(/^\?/, ``)}`
  }

  protected async invoke<T>(opts: TApiRequest): Promise<TApiResponse<T>> {
    const origFetch = globalThis.fetch
    if (this.mock) globalThis.fetch = this.mock as typeof fetch

    try {
      const result = await super.invoke<T>(opts)
      if (result.error && result.status === 401) {
        const refreshed = await tokenRefresh.refreshAndRetry()
        if (refreshed) return super.invoke<T>(opts)
      }
      return result
    } finally {
      if (this.mock) globalThis.fetch = origFetch
    }
  }

  fetch = async <R extends TApiData = TApiData>(opts: TApiReq): Promise<any> => {
    return this.invoke<R>({
      ...(opts as TApiRequest),
      method: opts.method || EApiMethod.GET,
    })
  }

  get = async <D extends TApiData = TApiData>(opts: TApiReq): Promise<any> => {
    const { queryKey, staleTime, refetchInterval, ...rest } = opts

    const [error, data] = await (async () => {
      try {
        const result = await query.fetch(
          query.options({
            queryKey,
            staleTime,
            refetchInterval,
            queryFn: async () => {
              const resp = await this.invoke<D>({
                ...(rest as TApiRequest),
                method: EApiMethod.GET,
              })
              if (resp.error) throw resp.error
              return resp.data
            },
          })
        )
        return [null, result]
      } catch (err) {
        return [err, undefined]
      }
    })()

    return { data, error }
  }

  post = async <D extends TApiData = TApiData>(opts: TApiReq): Promise<any> =>
    this.invoke<D>({ ...(opts as TApiRequest), method: EApiMethod.POST })

  put = async <D extends TApiData = TApiData>(opts: TApiReq): Promise<any> =>
    this.invoke<D>({ ...(opts as TApiRequest), method: EApiMethod.PUT })

  delete = async <D extends TApiData = TApiData>(opts: TApiReq): Promise<any> =>
    this.invoke<D>({ ...(opts as TApiRequest), method: EApiMethod.DELETE })
}

export const apiService = new ApiService()

export class BaseApi {
  api: typeof apiService

  constructor() {
    this.api = apiService
  }

  _onError = async (error?: Error | string, title?: string) => {
    if (!error) return
    const message = isStr(error) ? error : (error as Error)?.message
    toast.error(title || `API Error`, { description: message })
    console.warn(message)
  }
}

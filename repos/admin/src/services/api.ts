import type {
  TApiRes,
  TApiReq,
  TApiData,
  TApiReqEx,
  TFetchOpts,
  TApiService,
} from '@TAF/types'

import { toast } from 'sonner'
import { EAPIMethod } from '@TAF/types'
import { query } from '@TAF/services/query'
import { limbo } from '@keg-hub/jsutils/limbo'
import { isObj } from '@keg-hub/jsutils/isObj'
import { isStr } from '@keg-hub/jsutils/isStr'
import { authClient } from '@TAF/services/auth'
import { exists } from '@keg-hub/jsutils/exists'
import { emptyObj } from '@keg-hub/jsutils/emptyObj'
import { ApiError } from '@TAF/utils/errors/ApiError'
import { objToQuery } from '@TAF/utils/api/objToQuery'
import { deepMerge } from '@keg-hub/jsutils/deepMerge'
import { validateUrl } from '@TAF/utils/api/validateUrl'
import { genFormData } from '@TAF/utils/api/genFormData'

export class ApiService {
  base: string
  path?: string = `_`
  mock: typeof fetch
  #config: TApiService
  options: TApiReq = {
    headers: {
      [`Accept`]: `application/json`,
      [`Content-Type`]: `application/json`,
    },
  }

  constructor(cfg: TApiService = emptyObj) {
    this.configure(cfg)
  }

  get config(): TApiService {
    return this.#config
  }

  #ext = (opts: TApiReq): TApiReqEx => {
    const { form, method, url = this.base } = opts

    let base = url.replace(/\/$/, ``)
    if (this.path) base = `${base}/${this.path}`

    const path = opts.path ? `${opts.path.replace(/^\//, ``)}` : ``
    const ext: TApiReqEx = { url: `${base}/${path}` }

    if (opts.data) {
      method === EAPIMethod.GET
        ? (ext.url = `${ext.url}${objToQuery(opts.data)}`)
        : (ext.body = form === true ? genFormData(opts.data) : JSON.stringify(opts.data))
    }

    return ext
  }

  #error = (res: Response, data?: Record<`detail`, string> | string) => {
    const msg = isObj(data) ? data.detail : isStr(data) ? data : undefined
    return exists(msg) ? msg : res.statusText || `Request returned ${res.status}`
  }

  bearer = async () => {
    const { data } = await authClient.getSession()
    if (!data?.session?.token) return

    this.options.headers = {
      ...this.options.headers,
      Authorization: `Bearer ${data.session.token}`,
    }
  }

  configure = (cfg: TApiService = emptyObj) => {
    this.#config = deepMerge(this.#config, cfg)
    const { url, path, options } = this.#config

    if (path) this.path = path
    const valid = validateUrl(url)
    if (valid && this.base !== valid) this.base = valid

    if (options) this.options = deepMerge<TApiReq>(this.options, options)
  }

  fetch = async <R extends TApiData = TApiData>(opts: TApiReq): Promise<TApiRes<R>> => {
    const { data, path, form, responseType = `json`, ...rest } = opts
    const { body, ...ext } = this.#ext(opts)
    const { url, ...options } = deepMerge<TFetchOpts>(this.options, rest, ext)
    if (body) options.body = body

    const [error, res] = await limbo<TApiRes<R>, ApiError>(
      ((this.mock || fetch) as typeof fetch)(url, options)
        .then(async (res) => {
          const data = responseType !== `text` ? await res.json() : await res.text()

          if (res.status >= 400)
            return {
              error: new ApiError(this.#error(res, data), res.status),
            }

          return { data }
        })
        .catch((error) => ({ error: new ApiError(error, 400) }))
    )

    const err = error || res.error
    const resp = err ? { error: err } : res

    return resp
  }

  get = async <D extends TApiData = TApiData>(opts: TApiReq): Promise<TApiRes<D>> => {
    const { queryKey, staleTime, refetchInterval, ...rest } = opts

    const [error, data] = await limbo<D, ApiError>(
      query.fetch(
        query.options({
          queryKey,
          staleTime,
          refetchInterval,
          queryFn: async () => {
            const resp = await this.fetch<D>({ ...rest, method: EAPIMethod.GET })
            if (resp.error) throw resp.error
            return resp.data
          },
        })
      )
    )

    return { data, error }
  }

  post = async <D extends TApiData = TApiData>(opts: TApiReq) =>
    this.fetch<D>({
      ...opts,
      method: EAPIMethod.POST,
    })

  put = async <D extends TApiData = TApiData>(opts: TApiReq) =>
    this.fetch<D>({
      ...opts,
      method: EAPIMethod.PUT,
    })

  delete = async <D extends TApiData = TApiData>(opts: TApiReq) =>
    this.fetch<D>({
      ...opts,
      method: EAPIMethod.DELETE,
    })
}

export const apiService = new ApiService()
export class BaseApi {
  api: typeof apiService

  constructor() {
    this.api = apiService
  }

  _onError = async (error?: Error | string, title?: string) => {
    if (!error) return
    const message = isStr(error) ? error : error?.message
    toast.error(title || `API Error`, { description: message })
    console.warn(message)
  }
}

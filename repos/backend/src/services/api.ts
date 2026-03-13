import type {
  TFormData,
  TFetchOpts,
  TFetchResp,
  TFetchData,
  TFetchMethod,
} from '@TBE/types'

import { EAPIMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { limbo } from '@keg-hub/jsutils/limbo'
import { isObj } from '@keg-hub/jsutils/isObj'
import { objToQuery } from '@TBE/utils/api/objToQuery'
import { toFormData } from '@TBE/utils/api/toFormData'

type TApiOpts = Omit<
  TFetchOpts,
  `path` | `data` | `method` | `responseType` | `error` | `url`
> & {
  url: string
}

export class API {
  baseUrl: string
  opts: Omit<TApiOpts, `url`>
  headers: Record<string, string>

  constructor(opts: TApiOpts) {
    const { url, headers, ...rest } = opts
    this.opts = rest
    this.baseUrl = url
    this.headers = { ...headers }
  }

  #err = (message: string, status: number, text?: string) => {
    const statusText = text ? `Status: ${status} - ${text}` : ``
    const msg = [message, statusText].filter(Boolean).join(`\n`)
    return new Exception(status, msg)
  }

  #url = (
    url: string = this.baseUrl,
    path: string = ``,
    params?: string | Record<string, any>
  ) => {
    const baseUrlClean = url.replace(/\/$/, ``)
    const pathClean = path.replace(/^\//, ``)
    const built = pathClean ? `${baseUrlClean}/${pathClean}` : baseUrlClean
    if (!params) return built
    if (isObj(params)) return `${built}${objToQuery(params)}`
    return `${built}?${params.replace(/^\?/, ``)}`
  }

  #ext = (opts: TFetchOpts) => {
    const { url, data, path, form, error, method, responseType, ...rest } = opts

    const ext =
      method === EAPIMethod.GET
        ? { url: this.#url(url, path, data) }
        : {
            url: this.#url(url, path),
            body: form ? toFormData(data as TFormData) : JSON.stringify(data),
          }

    return {
      ...this.opts,
      ...rest,
      ...ext,
      method,
      headers: { ...this.headers, ...rest.headers },
    }
  }

  #call = async <T extends TFetchData = TFetchData>(opts: TFetchOpts) => {
    const { url, ...rest } = this.#ext(opts)

    const [error, res] = await limbo<TFetchResp<T>, Exception>(
      fetch(url, rest)
        .then(async (res) => {
          if (res.status >= 400) {
            const text = res.text ? await res.text() : res.statusText || `Request failed`
            return { error: this.#err(opts.error || ``, res.status, text) }
          }

          const data = opts.responseType !== `text` ? await res.json() : await res.text()
          return { data }
        })
        .catch((error) => ({ error: this.#err(error.message, 500) }))
    )

    const err = error || res?.error
    return err ? { error: err } : { ...res }
  }

  get = async <T extends TFetchData = TFetchData>(opts: TFetchMethod) => {
    return await this.#call<T>({
      ...opts,
      method: EAPIMethod.GET,
    })
  }

  post = async <T extends TFetchData = TFetchData>(opts: TFetchMethod) => {
    return await this.#call<T>({
      ...opts,
      method: EAPIMethod.POST,
    })
  }

  put = async <T extends TFetchData = TFetchData>(opts: TFetchMethod) => {
    return await this.#call<T>({
      ...opts,
      method: EAPIMethod.PUT,
    })
  }

  delete = async <T extends TFetchData = TFetchData>(opts: TFetchMethod) => {
    return await this.#call<T>({
      ...opts,
      method: EAPIMethod.DELETE,
    })
  }
}

import type { ApiError } from '@TAF/utils/errors/ApiError'
import type { TApiRequest, Exception } from '@tdsk/domain'
import type { TCacheQueryOpts } from '@TAF/types/query.types'

export type Payload = FormData | any
export type TApiData = Record<string, any>

/**
 * Admin-specific response type. Compatible with both the domain TApiResponse
 * and the legacy admin shape { data?, error? }.
 * Components and actions use this — it keeps both fields optional for ergonomics.
 */
export type TApiRes<D extends TApiData = TApiData> = {
  data?: D
  ok?: boolean
  status?: number
  error?: ApiError | Exception | Error
}

export type TApiItems<T extends TApiData = TApiData> = {
  items: T[]
}

export type TBody = Record<any, any>
export type TRedirect = `manual` | `follow` | `error`
export type TCorsOpt = `no-cors` | `cors` | `same-origin` | string
export type TCredsOpt = `same-origin` | `include` | `omit` | string
export type TCacheOpt = `no-cache` | `reload` | `force-cache` | `only-if-cached` | string
export type TReferrerPolicy =
  | `no-referrer`
  | `no-referrer-when-downgrade`
  | `origin`
  | `origin-when-cross-origin`
  | `same-origin, strict-origin`
  | `strict-origin-when-cross-origin`
  | `unsafe-url`

export type TApiReq<D extends TApiData = TApiData> = TApiRequest &
  TCacheQueryOpts & {
    data?: D
    url?: string
    path?: string
    form?: boolean
    id?: string | number
    responseType?: `text` | `json`
    headers?: Record<string, string>
  }

export type TApiReqEx = Omit<TApiReq, `body` | `data`> & {
  body?: string | FormData
}

export type TFetchOpts = Omit<Partial<Request>, `body`> & {
  body?: string | FormData
}

type TApiOpts = {
  headers?: Record<string, string>
}

export type TApiService = {
  url?: string
  path?: string
  token?: string
  options?: TApiOpts
}

import type { ApiError } from '@TTH/utils/errors/ApiError'
import type { TCacheQueryOpts } from '@TTH/types/query.types'

export enum EAPIMethod {
  GET = `GET`,
  PUT = `PUT`,
  POST = `POST`,
  DELETE = `DELETE`,
}

export type Payload = FormData | any
export type TApiData = Record<string, any>
export type TApiRes<D extends TApiData = TApiData> = {
  data?: D
  error?: ApiError
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

type TApiReqOpts<D extends TApiData = TApiData> = {
  data?: D
  url?: string
  path?: string
  form?: boolean
  mode?: TCorsOpt
  cache?: TCacheOpt
  id?: string | number
  method?: EAPIMethod
  credentials?: TCredsOpt
  responseType?: `text` | `json`
  headers?: Record<string, string>
}

export type TApiReq<D extends TApiData = TApiData> = Omit<
  Partial<Request>,
  `headers` | `body` | `url` | `path`
> &
  TApiReqOpts<D> &
  TCacheQueryOpts

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

import type { Exception } from '../error/exception'

export type TObjToQueryOpts = {
  array?: `string` | `repeated`
}

export enum EApiMethod {
  GET = `GET`,
  PUT = `PUT`,
  POST = `POST`,
  PATCH = `PATCH`,
  DELETE = `DELETE`,
}

export type TApiConfig = {
  url: string
  basePath?: string
  headers?: Record<string, string>
  options?: Omit<RequestInit, `body` | `headers` | `method`>
}

export type TApiRequest = Omit<Partial<RequestInit>, `body` | `headers` | `method`> & {
  path?: string
  form?: boolean
  error?: string
  timeout?: number
  rawResponse?: boolean
  method?: `${EApiMethod}`
  responseType?: `json` | `text`
  headers?: Record<string, string>
  data?: Record<string, any> | string
}

export type TApiResponse<T = Record<string, any>> = {
  data?: T
  ok: boolean
  status: number
  error?: Exception
}

export type TApiResponseObj = Omit<TApiResponse, `data`> & {
  response?: Response
}

export type TApiMeta = {
  limit?: number
  offset?: number
  warning?: string
  message?: string
  [key: string]: unknown
}

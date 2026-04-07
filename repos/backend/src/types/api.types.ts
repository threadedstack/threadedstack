import type { Exception } from '@tdsk/domain'

export type TFormData = Record<string, any>

export type TFetchMethod = Omit<Partial<RequestInit>, `body` | `headers`> & {
  error?: string
  path?: string
  form?: boolean
  responseType?: `json` | `text`
  headers?: Record<string, string>
  data?: string | Record<string, any>
}

export type TFetchOpts = TFetchMethod & {
  url?: string
  method: string
}

export type TFetchData = Record<string, any>

export type TFetchResp<T extends TFetchData = TFetchData> = {
  error?: Exception
  data?: T
}

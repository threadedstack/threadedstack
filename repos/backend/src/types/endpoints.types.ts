import type { router } from '@TBE/server/router'
import type { TReqHandler } from '@tdsk/domain'
import type { Options } from 'http-proxy-middleware'
import type { TApp, TRequest } from '@TBE/types/backend.types'

export type TConfigProxy = Options
export type TRequestHandler = TReqHandler

export type TMethodType = `get` | `put` | `post` | `patch` | `delete` | `all` | `use`

export type TEndpointConfig = {
  path: string
  public?: boolean
  proxy?: TConfigProxy
  originHeader?: boolean
  endpoints?: TEndpointsConfig
  middleware?: TRequestHandler[]
  action?: TReqHandler<TRequest>
  method: keyof Pick<typeof router, TMethodType> | EPMethod
}

export type TEndpointBuilder = (app: TApp) => TEndpointConfig

export type TEndpoint = TEndpointConfig | TEndpointBuilder

export type TEndpointsConfig = Record<string, TEndpoint>

export enum EPMethod {
  USE = `use`,
  use = `use`,
  Use = `use`,
  ALL = `all`,
  all = `all`,
  All = `all`,
  GET = `get`,
  get = `get`,
  Get = `get`,
  POST = `post`,
  post = `post`,
  Post = `post`,
  PUT = `put`,
  put = `put`,
  Put = `put`,
  PATCH = `patch`,
  patch = `patch`,
  Patch = `patch`,
  DELETE = `delete`,
  delete = `delete`,
  Delete = `delete`,
  PROXY = `proxy`,
  Proxy = `proxy`,
  proxy = `proxy`,
}

import type { TReqHandler } from '@tdsk/domain'
import type { Options } from 'http-proxy-middleware'
import type { TApp, TRequest } from '@TBE/types/backend.types'

export type TConfigProxy = Options

export type TEndpointConfig = {
  path: string
  public?: boolean
  method: EPMethod
  proxy?: TConfigProxy
  originHeader?: boolean
  middleware?: TReqHandler[]
  endpoints?: TEndpointsConfig
  action?: TReqHandler<TRequest>
}

export type TEndpointBuilder = (app: TApp) => TEndpointConfig

export type TEndpoint = TEndpointConfig | TEndpointBuilder

export type TEndpointsConfig = Record<string, TEndpoint>

export enum EPMethod {
  Use = `use`,
  All = `all`,
  Put = `put`,
  Get = `get`,
  Post = `post`,
  Patch = `patch`,
  Proxy = `proxy`,
  Delete = `delete`,
}

import type { TReqHandler } from '@tdsk/domain'
import type { TApp, TRequest } from '@TBE/types'
import type { Options } from 'http-proxy-middleware'

export type TConfigProxy = Options

export type TEndpointConfig = {
  path: string
  public?: boolean
  method: EPMethod
  proxy?: TConfigProxy
  originHeader?: boolean
  endpoints?: TEndpointsConfig
  action?: TReqHandler<TRequest>
  middleware?: TReqHandler<TRequest>[]
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

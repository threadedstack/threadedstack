import type { router } from '@TBE/server/router'
import type { TABConfig } from '@TBE/types/proxy.types'
import type { Request, Response, NextFunction } from 'express'
import type { RequestHandler, Options } from 'http-proxy-middleware'

export type TRequest = Request
export type TResponse = Response

export type TConfigProxy = Options
export type TEndpointMethod = (req?: Request, res?: Response, next?: NextFunction) => void
export type TRequestHandler = RequestHandler | TEndpointMethod

export type TEndpointConfig = {
  path: string
  public?: boolean
  proxy?: TConfigProxy
  originHeader?: boolean
  action?: TEndpointMethod
  endpoints?: TEndpointsConfig
  middleware?: TRequestHandler[]
  method:
    | keyof Pick<
        typeof router,
        `get` | `put` | `post` | `patch` | `delete` | `all` | `use`
      >
    | EPMethod
}

export type TEndpointBuilder = (config:TABConfig) => TEndpointConfig

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
}

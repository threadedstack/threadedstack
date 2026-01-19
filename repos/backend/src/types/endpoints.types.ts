import type { NextFunction } from 'express'
import type { TResponse } from '@tdsk/domain'
import type { router } from '@TBE/server/router'
import type { TBEConfig, TRequest, TApp } from '@TBE/types/backend.types'
import type { RequestHandler, Options } from 'http-proxy-middleware'

export type TConfigProxy = Options
export type TEndpointMethod = (
  req?: TRequest,
  res?: TResponse,
  next?: NextFunction
) => void
export type TRequestHandler = RequestHandler | TEndpointMethod

export type TMethodType = `get` | `put` | `post` | `patch` | `delete` | `all` | `use`

export type TEndpointConfig = {
  path: string
  public?: boolean
  proxy?: TConfigProxy
  originHeader?: boolean
  action?: TEndpointMethod
  endpoints?: TEndpointsConfig
  middleware?: TRequestHandler[]
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

import type { User } from '@TDM/models/user'
import type { TAuthHeaderObj } from '@TDM/types'
import type { Router, Express, Request, Response, NextFunction } from 'express'

type TCfg = Record<string, any>
type TDB = Record<string, any>
type TPay = Record<string, any>
type TEmail = Record<string, any>
type TAuth = Record<string, any>
type TKube = Record<string, any>
type TSandbox = Record<string, any>

export type TAppLocals<
  C extends TCfg = TCfg,
  D extends TDB = TDB,
  P extends TPay = TPay,
  E extends TEmail = TEmail,
  A extends TAuth = TAuth,
  K extends TKube = TKube,
  S extends TSandbox = TSandbox,
> = {
  db: D
  email?: E
  config: C
  payments: P
  auth: A
  kube: K
  sandbox: S
}

export type TApp<
  C extends TCfg = TCfg,
  D extends TDB = TDB,
  P extends TPay = TPay,
  E extends TEmail = TEmail,
  A extends TAuth = TAuth,
  K extends TKube = TKube,
  S extends TSandbox = TSandbox,
  L = TAppLocals<C, D, P, E, A, K, S>,
> = Express & {
  locals: L
}

export type TResLocals = {
  user?: User
  subdomain?: string
  auth?: TAuthHeaderObj
  subscriptionError?: boolean
}

export type TResponse<ResBody = any, Locals extends TResLocals = TResLocals> = Response<
  ResBody,
  Locals
>

export type TRequest<
  App extends TApp = TApp,
  ReqParams extends Record<string, any> = Record<string, any>,
  ResBody = any,
  ReqBody = any,
  ReqQuery extends Record<string, any> = Record<string, any>,
  Locals extends Record<string, any> = Record<string, any>,
> = Omit<Request<ReqParams, ResBody, ReqBody, ReqQuery, Locals>, `app`> & {
  app: App
  user?: User
}

export type TErrorHandler = (
  res: TResponse,
  err: Error,
  status: number,
  ...args: any
) => any

export type TAHandler<Req = TRequest, Res = TResponse> = (
  req: Req,
  res: Res,
  next?: NextFunction
) => Promise<any | void> | any | void

export type TReqHandler<Req = TRequest, Res = TResponse> = TAHandler<Req, Res> & {
  errHandler?: TErrorHandler
}

export type TReqHandlerOrRouter<Req = TRequest, Res = TResponse> =
  | TReqHandler<Req, Res>
  | TRouter
  | undefined

export type TRouter = Omit<
  Router,
  `all` | `get` | `put` | `post` | `head` | `patch` | `delete` | `options` | `use`
> & {
  all: (...args: [string, ...TReqHandler[]]) => ReturnType<Router[`all`]>
  get: (...args: [string, ...TReqHandler[]]) => ReturnType<Router[`get`]>
  put: (...args: [string, ...TReqHandler[]]) => ReturnType<Router[`put`]>
  use: (...args: [string, ...TReqHandler[]]) => ReturnType<Router[`use`]>
  post: (...args: [string, ...TReqHandler[]]) => ReturnType<Router[`post`]>
  head: (...args: [string, ...TReqHandler[]]) => ReturnType<Router[`head`]>
  patch: (...args: [string, ...TReqHandler[]]) => ReturnType<Router[`patch`]>
  delete: (...args: [string, ...TReqHandler[]]) => ReturnType<Router[`delete`]>
  options: (...args: [string, ...TReqHandler[]]) => ReturnType<Router[`options`]>
}

export type TAsyncWrap = ((
  handler: TReqHandler,
  errHandler?: TErrorHandler
) => (req: TRequest, res: TResponse, ...args: any[]) => Promise<any> | any) & {
  errHandler?: TErrorHandler
}

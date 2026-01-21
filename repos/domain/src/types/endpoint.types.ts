import type { User } from '@TDM/models/user'
import type { Router, Express, Request, Response, NextFunction } from 'express'

type TCfg = Record<string, any>
type TDB = Record<string, any>
type TPay = Record<string, any>
type TEmail = Record<string, any>

export type TAppLocals<
  C extends TCfg = TCfg,
  D extends TDB = TDB,
  P extends TPay = TPay,
  E extends TEmail = TEmail,
> = {
  db: D
  config: C
  payments: P
  email?: E
}

export type TApp<
  C extends TCfg = TCfg,
  D extends TDB = TDB,
  P extends TPay = TPay,
  E extends TEmail = TEmail,
  L = TAppLocals<C, D, P, E>,
> = Express & {
  locals: L
}

export type TResLocals = {
  user?: Record<string, any>
  subdomain?: string
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

export type TPostReq<
  App extends TApp = TApp,
  ReqBody extends Record<string, any> = Record<string, any>,
  ReqParams extends Record<string, any> = Record<string, any>,
  ResBody = any,
  ReqQuery extends Record<string, any> = Record<string, any>,
  Locals extends Record<string, any> = Record<string, any>,
> = TRequest<App, ReqParams, ResBody, ReqBody, ReqQuery, Locals>

export type TRequestHandler = (
  req: TRequest,
  res: TResponse,
  next: NextFunction
) => void | Promise<void>

export type TRouterHandler =
  | Router[`all`]
  | Router[`get`]
  | Router[`put`]
  | Router[`head`]
  | Router[`post`]
  | Router[`patch`]
  | Router[`delete`]
  | Router[`options`]

export type TErrorHandler = (
  res: TResponse,
  err: Error,
  status: number,
  ...args: any
) => any

export type TAHandler = (
  req: TRequest,
  res: TResponse,
  next?: NextFunction
) => Promise<any | void> | any | void

export type TReqHandler = TAHandler & {
  errHandler?: TErrorHandler
}

export type TRouter = Omit<
  Router,
  `all` | `get` | `put` | `post` | `head` | `patch` | `delete` | `options`
> & {
  all: (...args: [string, ...TReqHandler[]]) => ReturnType<Router[`all`]>
  get: (...args: [string, ...TReqHandler[]]) => ReturnType<Router[`get`]>
  put: (...args: [string, ...TReqHandler[]]) => ReturnType<Router[`put`]>
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

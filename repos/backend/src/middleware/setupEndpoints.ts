import type { TRouter, TReqHandler, TReqHandlerOrRouter } from '@tdsk/domain'
import type {
  TApp,
  TEndpoint,
  TEndpointConfig,
  TEndpointsConfig,
  TEndpointBuilder,
} from '@TBE/types'

import { EPMethod } from '@TBE/types'

import { endpoints } from '@TBE/endpoints'
import { isObj } from '@keg-hub/jsutils/isObj'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { ServerErr } from '@TBE/utils/errors/server'
import { IDParamPattern } from '@TBE/constants/values'
import { createAsyncRouter } from '@TBE/server/router'
import { validateIdParams } from '@TBE/utils/validation/id'
import { endpointProxy } from '@TBE/utils/proxy/endpointProxy'

type TEndpointWithRouter = Omit<TEndpointConfig, `action`> & {
  action: TReqHandlerOrRouter
}

const isValid = (
  router: TRouter,
  name: string,
  endpoint: TEndpointWithRouter | TEndpointConfig
) => {
  if (!isObj(endpoint)) return false
  if (endpoint.method === EPMethod.Use && !isObj(endpoint.endpoints)) return false

  if (!isFunc(router[endpoint?.method])) ServerErr.httpMethod(endpoint?.method)
  if (!endpoint?.path || !endpoint?.path.length) ServerErr.routePath(name)

  return true
}

const buildEndpoint = (
  app: TApp,
  router: TRouter,
  endpoint: TEndpointWithRouter | TEndpointConfig
) => {
  const { path, proxy, action, method, middleware = [], endpoints: children } = endpoint

  // Auto-inject ID param validation for routes with :id or :xxxId params
  const mw = IDParamPattern.test(path)
    ? [validateIdParams as TReqHandler, ...middleware]
    : middleware

  if (method === EPMethod.Use)
    router.use(
      path,
      ...mw,
      buildEndpoints(app, createAsyncRouter(), children, path) as unknown as TReqHandler
    )
  else if (method === EPMethod.Proxy)
    router.use(path, ...mw, endpointProxy(endpoint as TEndpointConfig))
  else if (isObj(proxy))
    router[method](path, ...mw, endpointProxy(endpoint as TEndpointConfig))
  else router[method](path, ...mw, action as TReqHandler)
}

const buildEndpoints = (
  app: TApp,
  router: TRouter,
  eps?: TEndpointsConfig,
  parentPath?: string
) => {
  if (!isObj<TEndpointsConfig>(eps)) return router

  Object.entries(eps).forEach(([name, ep]: [string, TEndpoint]) => {
    const endpoint = isFunc<TEndpointBuilder>(ep) ? ep(app) : ep
    if (isValid(router, name, endpoint)) buildEndpoint(app, router, endpoint)
    if (endpoint.public)
      app.locals.config.proxy.publicRoutes.push(`${parentPath || ``}${endpoint.path}`)
  })

  return router
}

export const setupEndpoints = (app: TApp, router: TRouter) =>
  buildEndpoints(app, router, endpoints)

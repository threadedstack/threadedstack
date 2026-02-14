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
import { createAsyncRouter } from '@TBE/server/router'
import { endpointProxy } from '@TBE/utils/proxy/endpointProxy'
import { validateUUIDParams } from '@TBE/utils/validation/uuid'

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

  !isFunc(router[endpoint?.method]) && ServerErr.httpMethod(endpoint?.method)

  ;(!endpoint?.path || !endpoint?.path.length) && ServerErr.routePath(name)

  return true
}

const UUIDParamPattern = /:(id|[a-zA-Z]+Id)\b/

const buildEndpoint = (
  app: TApp,
  router: TRouter,
  endpoint: TEndpointWithRouter | TEndpointConfig
) => {
  const { path, proxy, action, method, middleware = [], endpoints: children } = endpoint

  // Auto-inject UUID param validation for routes with :id or :xxxId params
  const mw = UUIDParamPattern.test(path)
    ? [validateUUIDParams as TReqHandler, ...middleware]
    : middleware

  method === EPMethod.Use
    ? router.use(
        path,
        ...mw,
        buildEndpoints(app, createAsyncRouter(), children, path) as unknown as TReqHandler
      )
    : method === EPMethod.Proxy
      ? router.use(path, ...mw, endpointProxy(endpoint as TEndpointConfig))
      : isObj(proxy)
        ? router[method](path, ...mw, endpointProxy(endpoint as TEndpointConfig))
        : router[method](path, ...mw, action as TReqHandler)
}

const buildEndpoints = (
  app: TApp,
  router: TRouter,
  eps?: TEndpointsConfig,
  parentPath?: string
) => {
  isObj<TEndpointsConfig>(eps) &&
    Object.entries(eps).forEach(([name, ep]: [string, TEndpoint]) => {
      const endpoint = isFunc<TEndpointBuilder>(ep) ? ep(app) : ep
      isValid(router, name, endpoint) && buildEndpoint(app, router, endpoint)
      endpoint.public &&
        app.locals.config.proxy.publicRoutes.push(`${parentPath || ``}${endpoint.path}`)
    })

  return router
}

export const setupEndpoints = (app: TApp, router: TRouter) =>
  buildEndpoints(app, router, endpoints)

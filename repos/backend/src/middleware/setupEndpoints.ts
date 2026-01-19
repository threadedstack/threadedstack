import type { Router } from 'express'
import type {
  TApp,
  TEndpoint,
  TBEConfig,
  TEndpointsConfig,
  TEndpointConfig,
  TEndpointBuilder,
} from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { endpoints } from '@TBE/endpoints'
import { isObj } from '@keg-hub/jsutils/isObj'
import { isFunc } from '@keg-hub/jsutils/isFunc'
import { ServerErr } from '@TBE/utils/errors/server'
import { createAsyncRouter } from '@TBE/server/router'
import { endpointProxy } from '@TBE/utils/proxy/endpointProxy'

const isValid = (router: Router, name: string, endpoint: TEndpointConfig) => {
  if (!isObj(endpoint)) return false

  if (endpoint.method === EPMethod.Use && !isObj(endpoint.endpoints)) return false

  !isFunc(router[endpoint?.method]) && ServerErr.httpMethod(endpoint?.method)

  ;(!endpoint?.path || !endpoint?.path.length) && ServerErr.routePath(name)

  return true
}

const buildEndpoint = (app: TApp, router: Router, endpoint: TEndpointConfig) => {
  const { path, proxy, action, method, middleware = [], endpoints: children } = endpoint

  method === EPMethod.Use
    ? router.use(
        path,
        ...middleware,
        buildEndpoints(app, createAsyncRouter(), children, path)
      )
    : method === EPMethod.Proxy
      ? router.use(path, ...middleware, endpointProxy(endpoint))
      : isObj(proxy)
        ? router[method](path, ...middleware, endpointProxy(endpoint))
        : router[method](path, ...middleware, action)
}

const buildEndpoints = (
  app: TApp,
  router: Router,
  eps: TEndpointsConfig,
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

export const setupEndpoints = (app: TApp, router: Router) =>
  buildEndpoints(app, router, endpoints)

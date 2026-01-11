import type { Router } from 'express'

import type {
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
import { endpointProxy } from '@TBE/utils/proxy/endpointProxy'
import { createAsyncRouter } from '@TBE/server/router'

const isValid = (router: Router, name: string, endpoint: TEndpointConfig) => {
  if (!isObj(endpoint)) return false

  if (endpoint.method === EPMethod.Use && !isObj(endpoint.endpoints)) return false

  !isFunc(router[endpoint?.method]) && ServerErr.httpMethod(endpoint?.method)

  ;(!endpoint?.path || !endpoint?.path.length) && ServerErr.routePath(name)

  return true
}

const buildEndpoint = (router: Router, config: TBEConfig, endpoint: TEndpointConfig) => {
  const { path, proxy, action, method, middleware = [], endpoints: children } = endpoint

  method === EPMethod.Use
    ? router.use(
        path,
        ...middleware,
        buildEndpoints(createAsyncRouter(), config, children, path)
      )
    : isObj(proxy)
      ? router[method](path, ...middleware, endpointProxy(endpoint))
      : router[method](path, ...middleware, action)
}

const buildEndpoints = (
  router: Router,
  config: TBEConfig,
  eps: TEndpointsConfig,
  parentPath?: string
) => {
  isObj<TEndpointsConfig>(eps) &&
    Object.entries(eps).forEach(([name, ep]: [string, TEndpoint]) => {
      const endpoint = isFunc<TEndpointBuilder>(ep) ? ep(config) : ep
      isValid(router, name, endpoint) && buildEndpoint(router, config, endpoint)
      endpoint.public &&
        config.proxy.publicRoutes.push(`${parentPath || ``}${endpoint.path}`)
    })

  return router
}

export const setupEndpoints = (router: Router, config: TBEConfig) =>
  buildEndpoints(router, config, endpoints)

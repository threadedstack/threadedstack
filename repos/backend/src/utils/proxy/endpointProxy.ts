import type { TEndpointConfig, TConfigProxy } from '@TBE/types'
import type { RequestHandler, Filter } from 'http-proxy-middleware'

import { buildProxy } from './buildProxy'
import { createProxyMiddleware } from 'http-proxy-middleware'

/**
 * Builds the config for a custom proxy based on passed in routObj
 * Allows creating a proxy to custom urls
 */
export const endpointProxy = (endpoint: TEndpointConfig): RequestHandler => {
  return createProxyMiddleware(buildProxy(endpoint))
}

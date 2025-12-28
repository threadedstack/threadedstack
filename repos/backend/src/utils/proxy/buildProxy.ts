import type { Request } from 'express'
import type { ServerResponse } from 'node:http'
import type { TEndpointConfig, TConfigProxy } from '@TBE/types'

import { app } from '@TBE/server/app'
import { isFunc } from '@keg-hub/jsutils'
import { logger } from '@TBE/utils/logger'
import { proxyError } from '@TBE/utils/proxy/proxyError'
import { addProxyHeader, addOriginHeader } from '@TBE/utils/proxy/proxyHeaders'

/**
 * Builds a config object to pass to the createProxyMiddleware method
 * Uses the passed in endpoint to know which options to include
 */
export const buildProxy = (endpoint: TEndpointConfig) => {
  const { path, proxy, originHeader = true } = endpoint
  const { on, pathRewrite, pathFilter = path, ...rest } = proxy

  return {
    logger,
    ...rest,
    pathFilter,
    ...(isFunc(pathRewrite) ? { pathRewrite } : {}),
    on: {
      ...on,
      error: (err, req, res) => {
        proxyError(err, req, res as ServerResponse)
        if (isFunc(on?.error)) return on.error(err, req, res)
      },
      proxyReq: (proxyReq, req, res, options) => {
        addProxyHeader(proxyReq, app.locals.config)
        if (isFunc(on?.proxyReq)) return on.proxyReq(proxyReq, req, res, options)
      },
      proxyRes: (proxyRes, req, res) => {
        originHeader && addOriginHeader(proxyRes, req as Request, app.locals.config)

        if (isFunc(on?.proxyRes)) return on.proxyRes(proxyRes, req as Request, res)
      },
    },
  } as TConfigProxy
}

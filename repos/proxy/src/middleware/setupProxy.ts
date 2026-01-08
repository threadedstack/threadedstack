import type { Request } from 'express'
import type { TProxyApp } from '@TPX/types'
import type { Options } from 'http-proxy-middleware'
import type { ClientRequest, IncomingMessage, ServerResponse } from 'http'

import { logger } from '@TPX/utils/logger'
import { adminPath } from '@TPX/utils/auth/adminPath'
import { createProxyMiddleware } from 'http-proxy-middleware'

/**
 * Add custom headers to proxied requests
 */
const addProxyHeaders = (
  proxyReq: ClientRequest,
  req: Request,
  config: TProxyApp['locals']['config']
) => {
  config.backend.headerKey &&
    config.backend.headerValue &&
    proxyReq.setHeader(config.backend.headerKey, config.backend.headerValue)

  if (!req.user) return

  proxyReq.setHeader(`X-User-Id`, req.user.userId)
  req.user.teamId && proxyReq.setHeader(`X-Team-Id`, req.user.teamId)
  req.user.role && proxyReq.setHeader(`X-User-Role`, req.user.role)
}

/**
 * Handle proxy errors
 */
const handleProxyError = (
  err: Error,
  _req: IncomingMessage,
  res: ServerResponse | null
): void => {
  logger.error(`Proxy error: ${err.message}`, { stack: err.stack })

  if (res && !res.headersSent) {
    res.writeHead(502, { 'Content-Type': `application/json` })
    res.end(JSON.stringify({ error: `Backend service unavailable` }))
  }
}

/**
 * Creates proxy middleware for forwarding requests to the backend
 * Handles /_/* routes by forwarding to the backend server
 */
const createBackendProxy = (app: TProxyApp, loc: string) => {
  const { backend } = app.locals.config

  const proxyOptions: Options = {
    logger,
    ws: true,
    changeOrigin: true,
    target: backend.url,
    pathRewrite: {
      [`^${loc}`]: loc,
    },
    on: {
      error: handleProxyError,
      proxyReq: (proxyReq, req) => {
        addProxyHeaders(proxyReq, req as Request, app.locals.config)
      },
      proxyRes: (proxyRes, req) => {
        logger.debug(`Proxy response: ${req.method} ${req.url} -> ${proxyRes.statusCode}`)
      },
    },
  }

  return createProxyMiddleware(proxyOptions)
}

export const setupProxy = (app: TProxyApp) => {
  const loc = adminPath(app.locals.config)
  app.use(loc, createBackendProxy(app, loc))
}

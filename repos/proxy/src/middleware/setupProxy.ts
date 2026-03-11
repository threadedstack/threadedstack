import type { Socket } from 'net'
import type { TProxyApp } from '@TPX/types'
import type { Options } from 'http-proxy-middleware'
import type { Request, Response, NextFunction } from 'express'
import type { ClientRequest, IncomingMessage, ServerResponse } from 'http'

import { logger } from '@TPX/utils/logger'
import { SandboxHostRx } from '@TPX/constants/values'
import { adminPath, setAuthHeaders } from '@tdsk/domain'
import { ProxyForwardRoutes } from '@TPX/constants/values'
import { createProxyMiddleware } from 'http-proxy-middleware'

const isSandboxHost = (host: string) => SandboxHostRx.test(host.split(`.`)[0])

/**
 * Add custom headers to proxied requests
 */
const addProxyHeaders = (
  proxyReq: ClientRequest,
  req: Request,
  config: TProxyApp[`locals`][`config`]
) => {
  config.backend.headerKey &&
    config.backend.headerValue &&
    proxyReq.setHeader(config.backend.headerKey, config.backend.headerValue)

  setAuthHeaders(proxyReq, req)
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
    res.writeHead(502, { [`Content-Type`]: `application/json` })
    res.end(JSON.stringify({ error: `Backend service unavailable` }))
  }
}

const pathFilter = (loc: string) => {
  return `/${loc.replace(/\/$/, ``).replace(/^\//, ``)}`
}

const buildProxyOptions = (app: TProxyApp, changeOrigin: boolean): Options => {
  const { backend } = app.locals.config

  return {
    logger,
    ws: false,
    xfwd: true,
    changeOrigin,
    target: backend.url,
    pathRewrite: (_path, req: Request) => req.originalUrl,
    on: {
      error: handleProxyError,
      proxyReq: (proxyReq, req: Request) => {
        addProxyHeaders(proxyReq, req as Request, app.locals.config)
      },
      proxyRes: (proxyRes, req) => {
        logger.debug(`Proxy response: ${req.method} ${req.url} -> ${proxyRes.statusCode}`)
      },
    },
  }
}

/**
 * Creates proxy middleware for forwarding requests to the backend.
 * Handles /_/* , /ai/*, /proxy/* routes.
 * Uses changeOrigin:true — standard backend forwarding.
 */
const createBackendProxy = (app: TProxyApp) => {
  return createProxyMiddleware(buildProxyOptions(app, true))
}

/**
 * Creates a middleware that intercepts sandbox subdomain requests and
 * forwards them to the backend with the original Host header preserved.
 *
 * Standard proxy uses changeOrigin:true which rewrites Host to the
 * backend's internal hostname. Sandbox requests need the original
 * hostname so the backend's sandboxProxy middleware can parse the
 * subdomain and route to the correct pod.
 */
const createSandboxForwarder = (app: TProxyApp) => {
  const proxy = createProxyMiddleware(buildProxyOptions(app, false))

  const middleware = (req: Request, res: Response, next: NextFunction) => {
    const host = req.hostname || req.headers.host?.split(`:`)[0] || ``
    if (!isSandboxHost(host)) return next()
    proxy(req, res, next)
  }

  middleware.upgrade = proxy.upgrade

  return middleware
}

export const setupProxy = (app: TProxyApp) => {
  const loc = adminPath(app.locals.config.backend)

  const sandboxProxy = createSandboxForwarder(app)
  const backendProxy = createBackendProxy(app)

  app.use(sandboxProxy)
  app.use([pathFilter(loc), ...ProxyForwardRoutes], backendProxy)

  /**
   * Manual WebSocket upgrade handler — routes upgrade requests to the
   * correct proxy based on hostname. Both proxies use ws:false to prevent
   * auto-registering global upgrade listeners (which conflict when there
   * are multiple proxy instances).
   *
   * Pattern from .temp/conductor: single onUpgrade dispatches to the
   * correct proxy via proxy.upgrade(req, socket, head).
   */
  const onUpgrade = (req: IncomingMessage, socket: Socket, head: Buffer) => {
    const host = req.headers.host?.split(`:`)[0] || ``

    if (isSandboxHost(host)) sandboxProxy.upgrade?.(req, socket, head)
    else backendProxy.upgrade?.(req, socket, head)
  }

  app.locals.onUpgrade = onUpgrade
}

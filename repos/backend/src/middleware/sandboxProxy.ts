import type { TApp } from '@TBE/types'
import type { Request, Response, NextFunction } from 'express'

import { logger } from '@TBE/utils/logger'
import { parseSandboxHost } from '@tdsk/sandbox'
import { SandboxService } from '@TBE/services/sandboxes/sandbox'

/**
 * Middleware that intercepts sandbox subdomain requests and proxies
 * them to the correct pod IP/port based on the in-memory route map.
 * Supports both HTTP and WebSocket connections (via `ws: true` in createProxyMiddleware).
 *
 * Request flow: Caddy (wildcard TLS) → Proxy (auth) → Backend (this middleware)
 *   → Parse hostname: extract port + subdomain
 *   → Lookup in-memory route map: subdomain → podIP
 *   → Forward to podIP:port
 */
export const setupSandboxProxy = (app: TApp) => {
  app.use((req: Request, res: Response, next: NextFunction) => {
    const host = req.hostname || req.headers.host?.split(`:`)[0]
    if (!host) return next()

    const parsed = parseSandboxHost(host)
    if (!parsed) return next()

    const { port, subdomain } = parsed
    const routes = app.locals.kube?.routes

    if (!routes) return next()

    const route = routes[subdomain]
    if (!route) {
      logger.error(`Could not find route from subdomain "${subdomain}"`, { host, routes })
      res.status(404).json({ error: `Sandbox not found` })
      return
    }

    const portEntry = route.ports[port]
    if (!portEntry) {
      logger.error(
        `Port "${port}" not exposed on this sandbox with subdomain "${subdomain}"`,
        { host, route }
      )
      res.status(404).json({ error: `Port ${port} not exposed on this sandbox` })
      return
    }

    const target = `${portEntry.protocol}://${portEntry.host}:${portEntry.port}`
    const proxy = SandboxService.getPodProxy(target)
    proxy(req, res, next)
  })
}

import type { TProxyApp } from '@TPX/types'
import type { Request, Response, NextFunction } from 'express'

import { Auth } from '@TPX/services/auth'
import { logger } from '@TPX/utils/logger'
import { ApiKeyPrefix } from '@tdsk/domain'

/**
 * JWT Authentication middleware
 * Validates JWT tokens using JWKS and attaches user info to request
 *
 * Client-side auth flow:
 * 1. Admin app authenticates directly with Neon Auth
 * 2. Neon Auth returns JWT token
 * 3. Admin app sends JWT in Authorization header
 * 4. This middleware validates JWT using JWKS endpoint
 *
 * Deferred-auth routes (e.g., /proxy/*):
 * - JWT validation is attempted but failures are non-blocking
 * - If JWT is valid, req.user is populated normally
 * - If JWT is invalid/missing/expired, request passes through without req.user
 * - Backend is responsible for enforcing auth based on endpoint config
 */
export const validateAuth = (app: TProxyApp) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (app.locals.auth.isPublic(req.path)) {
      logger.debug(`Public route accessed: ${req.path}`)
      return next()
    }

    const token = app.locals.auth.extract(req)

    if (!token) return next()
    // Token present but starts with tdsk_ — it's an API key, not a JWT
    if (token.startsWith(ApiKeyPrefix)) return next()

    // Deferred-auth routes attempt JWT validation but never block on failure —
    // the backend decides auth based on the endpoint's public flag
    const deferAuth = app.locals.auth.isDeferredAuth(req.path)

    if (!app.locals.auth.initialized()) {
      if (deferAuth) {
        logger.error(
          `Auth client not initialized — forwarding deferred-auth route without identity`,
          {
            path: req.path,
          }
        )
        return next()
      }
      logger.error(`Proxy Auth client not initialized`)
      res.status(500).json({ error: `Authentication service unavailable` })
      return
    }

    try {
      const result = await app.locals.auth.verify(token)

      if (!result.valid || !result.payload) {
        if (deferAuth) {
          logger.debug(
            `JWT validation failed on deferred-auth route, forwarding without identity`,
            {
              path: req.path,
              expired: result.expired ?? false,
            }
          )
          return next()
        }
        res
          .status(401)
          .json({ error: result.expired ? `Token expired` : `Invalid token` })
        return
      }

      req.user = {
        email: result.payload.email || ``,
        role: result.payload.role || `user`,
        userId: result.payload.sub || result.payload.userId || ``,
      }

      logger.debug(`JWT validated for user: ${req.user.userId}`)
      next()
    } catch (err) {
      if (deferAuth) {
        logger.warn(
          `JWT verification failed on deferred-auth route, forwarding without identity`,
          {
            path: req.path,
            error: err instanceof Error ? err.message : String(err),
          }
        )
        return next()
      }
      logger.error(`JWT verification error:`, err)
      res.status(500).json({ error: `Authentication error` })
    }
  }
}

export const setupAuth = (app: TProxyApp) => {
  app.locals.auth = new Auth({ url: app.locals.config.jwks.jwksUrl })
  app.use(validateAuth(app))
}

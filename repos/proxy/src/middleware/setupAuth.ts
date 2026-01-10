import type { TProxyApp } from '@TPX/types'
import type { Request, Response, NextFunction } from 'express'

import { Auth } from '@TPX/services/auth'
import { logger } from '@TPX/utils/logger'

/**
 * JWT Authentication middleware
 * Validates JWT tokens using JWKS and attaches user info to request
 *
 * Client-side auth flow:
 * 1. Admin app authenticates directly with Neon Auth
 * 2. Neon Auth returns JWT token
 * 3. Admin app sends JWT in Authorization header
 * 4. This middleware validates JWT using JWKS endpoint
 */
export const setupAuth = (app: TProxyApp) => {
  app.locals.auth = new Auth({ url: app.locals.config.jwks.jwksUrl })

  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (app.locals.auth.isPublic(req.path)) {
      logger.debug(`Public route accessed: ${req.path}`)
      return next()
    }

    const token = app.locals.auth.extract(req)

    if (!token) {
      res.status(401).json({ error: `No authentication token provided` })
      return
    }

    logger.debug(`Attempting JWT token validation`)

    if (!app.locals.auth.initialized()) {
      logger.error(`Auth client not initialized`)
      res.status(500).json({ error: `Authentication service unavailable` })
      return
    }

    try {
      const result = await app.locals.auth.verify(token)

      if (!result.valid || !result.payload) {
        const isExpired = result.error?.includes(`expired`)
        res.status(401).json({ error: isExpired ? `Token expired` : `Invalid token` })
        return
      }

      req.user = {
        teamId: result.payload.teamId,
        email: result.payload.email || ``,
        role: result.payload.role || `user`,
        userId: result.payload.sub || result.payload.userId || ``,
      }

      logger.debug(`JWT validated for user: ${req.user.userId}`)
      next()
    } catch (err) {
      logger.error(`JWT verification error:`, err)
      res.status(500).json({ error: `Authentication error` })
    }
  }
}

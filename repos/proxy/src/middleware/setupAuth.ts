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
export const validateAuth = (app: TProxyApp) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (app.locals.auth.isPublic(req.path)) {
      logger.debug(`Public route accessed: ${req.path}`)
      return next()
    }

    // /ai/chat uses session-token auth, skip JWT
    if (req.path.startsWith(`/ai/chat`)) return next()

    const token = app.locals.auth.extract(req)

    if (!token) return next()
    // Token present but starts with tdsk_ — it's an API key, not a JWT
    if (token.startsWith(`tdsk_`)) return next()

    if (!app.locals.auth.initialized()) {
      logger.error(`Auth client not initialized`)
      res.status(500).json({ error: `Authentication service unavailable` })
      return
    }

    try {
      const result = await app.locals.auth.verify(token)

      if (!result.valid || !result.payload) {
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
      logger.error(`JWT verification error:`, err)
      res.status(500).json({ error: `Authentication error` })
    }
  }
}

export const setupAuth = (app: TProxyApp) => {
  app.locals.auth = new Auth({ url: app.locals.config.jwks.jwksUrl })
  app.use(validateAuth(app))
}

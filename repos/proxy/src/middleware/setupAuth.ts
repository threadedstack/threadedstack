import type { TProxyApp, TTokenPayload } from '@TPX/types'
import type { Request, Response, NextFunction } from 'express'

import { logger } from '@TPX/utils/logger'
import { extractToken } from '@TPX/utils/auth/authToken'
import { isPublicRoute } from '@TPX/utils/auth/isPublicRoute'
import jwt, { TokenExpiredError, JsonWebTokenError } from 'jsonwebtoken'

/**
 * JWT Authentication middleware
 * Validates JWT tokens and attaches user info to request
 */
export const setupAuth = (app: TProxyApp) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (isPublicRoute(req.path)) return next()

    const token = extractToken(req)

    if (!token) {
      res.status(401).json({ error: `No authentication token provided` })
      return
    }

    try {
      const secret = app.locals.config.jwt.secret
      const decoded = jwt.verify(token, secret) as TTokenPayload

      req.user = {
        role: decoded.role,
        email: decoded.email,
        teamId: decoded.teamId,
        userId: decoded.userId,
      }

      logger.debug(`Authenticated user: ${decoded.userId}`)
      next()
    } catch (err) {
      if (err instanceof TokenExpiredError) {
        res.status(401).json({ error: `Token expired` })
        return
      }

      if (err instanceof JsonWebTokenError) {
        res.status(401).json({ error: `Invalid token` })
        return
      }

      logger.error(`JWT verification error:`, err)
      res.status(500).json({ error: `Authentication error` })
    }
  }
}

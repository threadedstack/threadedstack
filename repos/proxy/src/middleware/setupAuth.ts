import type { TProxyApp } from '@TPX/types'
import type { Request, Response, NextFunction } from 'express'

import { logger } from '@TPX/utils/logger'
import { extractToken } from '@TPX/utils/auth/authToken'
import { isPublicRoute } from '@TPX/utils/auth/isPublicRoute'
import { verifyToken, isJWKSInitialized } from '@TPX/utils/auth/neonAuth'

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
export const setupAuth = (_app: TProxyApp) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // Skip auth for public routes
    if (isPublicRoute(req.path)) {
      logger.debug(`Public route accessed: ${req.path}`)
      return next()
    }

    // Extract Bearer token from Authorization header
    const token = extractToken(req)

    if (!token) {
      res.status(401).json({ error: `No authentication token provided` })
      return
    }

    logger.debug(`Attempting JWT token validation`)

    // Check if JWKS is initialized
    if (!isJWKSInitialized()) {
      logger.error(`JWKS client not initialized`)
      res.status(500).json({ error: `Authentication service unavailable` })
      return
    }

    try {
      // Verify token using JWKS
      const result = await verifyToken(token)

      if (!result.valid || !result.payload) {
        const isExpired = result.error?.includes('expired')
        res.status(401).json({
          error: isExpired ? `Token expired` : `Invalid token`,
        })
        return
      }

      // Attach user info from token payload
      req.user = {
        userId: result.payload.sub || result.payload.userId || ``,
        email: result.payload.email || ``,
        teamId: result.payload.teamId,
        role: result.payload.role || 'user',
      }

      logger.debug(`JWT validated for user: ${req.user.userId}`)
      next()
    } catch (err) {
      logger.error(`JWT verification error:`, err)
      res.status(500).json({ error: `Authentication error` })
    }
  }
}

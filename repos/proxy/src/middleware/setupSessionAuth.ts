import type { TProxyApp } from '@TPX/types'
import type { Request, Response, NextFunction } from 'express'

import { logger } from '@TPX/utils/logger'

/**
 * Session-token authentication middleware for SessionRoutes: /ai/chat, /ai/ws
 *
 * Ensures a session token is present in the Authorization header.
 * The actual token validation happens in the backend — this middleware
 * only checks that the token exists and is in the correct format.
 */
export const validateSessionAuth = (app: TProxyApp) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!app.locals.auth.isSession(req.path)) return next()
    if (req.user) return next()

    const authHeader = req.headers.authorization
    const token = app.locals.auth.extract(req)
    if (!token) {
      logger.warn(
        `Missing session token for ${req.path}\nAuthorization Header: ${authHeader}`
      )
      res.status(401).json({ error: `Session token required` })
      return
    }

    logger.debug(`Session token present for ${req.path}`)
    next()
  }
}

export const setupSessionAuth = (app: TProxyApp) => {
  app.use(validateSessionAuth(app))
}

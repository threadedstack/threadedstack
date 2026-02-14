import type { TProxyApp } from '@TPX/types'
import type { Request, Response, NextFunction } from 'express'

import { logger } from '@TPX/utils/logger'

const SessionPrefix = `Session `

/**
 * Session-token authentication middleware for /ai/chat
 *
 * Ensures a session token is present in the Authorization header.
 * The actual token validation happens in the backend — this middleware
 * only checks that the token exists and is in the correct format.
 */
export const validateSessionAuth = (_app: TProxyApp) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    // Only apply to /ai/chat routes
    if (!req.path.startsWith(`/ai/chat`)) return next()

    const authHeader = req.headers.authorization
    if (!authHeader || !authHeader.startsWith(SessionPrefix)) {
      logger.warn(`Missing session token for ${req.path}`)
      res.status(401).json({ error: `Session token required` })
      return
    }

    const token = authHeader.slice(SessionPrefix.length).trim()
    if (!token) {
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

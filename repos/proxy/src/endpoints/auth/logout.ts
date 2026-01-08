import type { TProxyApp } from '@TPX/types'
import type { Request, Response } from 'express'

import { logger } from '@TPX/utils/logger'

/**
 * POST /auth/logout
 * Invalidates the current user session
 *
 * Note: For stateless JWT, the client is responsible for discarding the token.
 * In production, you may want to implement a token blacklist in Redis/database.
 */
export const logout = (_app: TProxyApp) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const userId = req.user?.userId

      if (userId) {
        logger.info(`Logout for user: ${userId}`)
        // TODO: In production, add token to blacklist if implementing server-side session invalidation
      }

      res.status(200).json({
        data: {
          message: `Logged out successfully`,
        },
      })
    } catch (err) {
      logger.error(`Logout error:`, err)
      res.status(500).json({ error: `Logout failed` })
    }
  }
}

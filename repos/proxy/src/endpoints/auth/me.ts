import type { TProxyApp } from '@TPX/types'
import type { Request, Response } from 'express'

import { logger } from '@TPX/utils/logger'

/**
 * GET /auth/me
 * Returns the current authenticated user's information
 */
export const me = (_app: TProxyApp) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      const user = req.user

      if (!user) {
        res.status(401).json({ error: `Not authenticated` })
        return
      }

      logger.debug(`Get current user: ${user.userId}`)

      // TODO: In production, fetch additional user data from database
      // For now, return the user info from the JWT

      res.status(200).json({
        data: {
          userId: user.userId,
          email: user.email,
          teamId: user.teamId,
          role: user.role,
        },
      })
    } catch (err) {
      logger.error(`Get current user error:`, err)
      res.status(500).json({ error: `Failed to get user info` })
    }
  }
}

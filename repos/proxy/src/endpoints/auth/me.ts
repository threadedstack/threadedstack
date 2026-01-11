import type { TProxyApp } from '@TPX/types'
import type { Request, Response } from 'express'

import { logger } from '@TPX/utils/logger'

/**
 * GET /auth/me
 * Returns the current authenticated user's information from JWT
 *
 * In client-side auth flow:
 * - JWT is validated by middleware and user info is attached to req.user
 * - This endpoint simply returns the decoded user info from the JWT
 */
export const me = (_app: TProxyApp) => {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // User info is attached to request by JWT validation middleware
      const user = req.user

      if (!user) {
        res.status(401).json({ error: `Not authenticated` })
        return
      }

      logger.debug(`Get current user: ${user.userId}`)

      res.status(200).json({
        data: {
          user: {
            id: user.userId,
            role: user.role,
            email: user.email,
            orgId: user.orgId,
          },
        },
      })
    } catch (err) {
      logger.error(`Get current user error:`, err)
      res.status(500).json({ error: `Failed to get user info` })
    }
  }
}

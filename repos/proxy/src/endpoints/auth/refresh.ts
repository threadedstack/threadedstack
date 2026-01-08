import type { Request, Response } from 'express'
import type { TProxyApp, TRefreshRequest } from '@TPX/types'

import { logger } from '@TPX/utils/logger'
import {
  verifyRefreshToken,
  generateAccessToken,
  generateRefreshToken,
} from '@TPX/utils/auth/authToken'

/**
 * POST /auth/refresh
 * Refreshes access token using a valid refresh token
 */
export const refresh = (app: TProxyApp) => {
  return async (req: Request, res: Response): Promise<void> => {
    const { refreshToken } = req.body as TRefreshRequest

    if (!refreshToken) {
      res.status(400).json({ error: `Refresh token is required` })
      return
    }

    try {
      const { jwt: jwtConfig } = app.locals.config

      const payload = verifyRefreshToken(refreshToken, jwtConfig.secret)

      if (!payload) {
        res.status(401).json({ error: `Invalid refresh token` })
        return
      }

      logger.info(`Token refresh for user: ${payload.userId}`)

      const newAccessToken = generateAccessToken(
        { userId: payload.userId, email: payload.email },
        jwtConfig.secret,
        jwtConfig.expiresIn
      )

      const newRefreshToken = generateRefreshToken(
        { userId: payload.userId, email: payload.email },
        jwtConfig.secret,
        jwtConfig.refreshExpiresIn
      )

      res.status(200).json({
        data: {
          token: newAccessToken,
          refreshToken: newRefreshToken,
        },
      })
    } catch (err) {
      logger.error(`Token refresh error:`, err)
      res.status(500).json({ error: `Token refresh failed` })
    }
  }
}

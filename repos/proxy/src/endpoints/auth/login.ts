import type { Request, Response } from 'express'
import type { TProxyApp, TLoginRequest } from '@TPX/types'

import { logger } from '@TPX/utils/logger'
import { generateAccessToken, generateRefreshToken } from '@TPX/utils/auth/authToken'

/**
 * POST /auth/login
 * Authenticates user credentials and returns JWT tokens
 *
 * Note: This is a placeholder implementation.
 * In production, this should validate against Neon Auth or your auth provider.
 */
export const login = (app: TProxyApp) => {
  return async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as TLoginRequest

    if (!email || !password) {
      res.status(400).json({ error: `Email and password are required` })
      return
    }

    try {
      // TODO: Integrate with Neon Auth or validate against database
      // For now, this is a placeholder that should be replaced with actual auth logic
      // In production: validate credentials against auth provider

      logger.info(`Login attempt for: ${email}`)

      // Placeholder user data - in production this comes from auth provider
      const user = {
        userId: `user-${Date.now()}`,
        email,
        // teamId and role would come from database lookup
      }

      const { jwt: jwtConfig } = app.locals.config

      const accessToken = generateAccessToken(
        { userId: user.userId, email: user.email },
        jwtConfig.secret,
        jwtConfig.expiresIn
      )

      const refreshToken = generateRefreshToken(
        { userId: user.userId, email: user.email },
        jwtConfig.secret,
        jwtConfig.refreshExpiresIn
      )

      logger.info(`Login successful for: ${email}`)

      res.status(200).json({
        data: {
          token: accessToken,
          refreshToken,
          user: {
            userId: user.userId,
            email: user.email,
          },
        },
      })
    } catch (err) {
      logger.error(`Login error:`, err)
      res.status(500).json({ error: `Authentication failed` })
    }
  }
}

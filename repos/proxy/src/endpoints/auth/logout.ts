import type { Request, Response } from 'express'

import { logger } from '@TPX/utils/logger'

/**
 * POST /auth/logout
 * Client-side logout acknowledgment endpoint
 *
 * In client-side auth flow:
 * - Admin app handles signout with Neon Auth directly
 * - This endpoint is called to confirm logout and clear any server-side state
 * - JWT tokens are invalidated on client side
 */
export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = req.user?.userId

    logger.info(`Logout request received`, { userId })

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

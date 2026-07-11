import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { isFeatureEnabled, ApprovedRole, WaitlistRole } from '@tdsk/domain'

export const welcomeNewUser = async (
  req: TRequest,
  res: TResponse,
  next: NextFunction
) => {
  try {
    if (isFeatureEnabled(`accessGate`)) return next()

    const user = req.user
    if (!user || !user.email) return next()

    const role = user.role
    if (role === ApprovedRole || role === WaitlistRole) return next()

    const { db, email, config } = req.app.locals
    if (!email) return next()

    try {
      await db.services.user.update({
        id: user.id,
        role: ApprovedRole,
      })
    } catch (err: unknown) {
      logger.error(
        `[welcomeNewUser] Failed to set approved role for user ${user.id}:`,
        err
      )
    }

    email
      .welcome({
        email: user.email,
        adminUrl: config.urls.admin,
        threadsUrl: config.urls.threads,
        name: user.displayName || user.name || ``,
      })
      .catch((err: unknown) => {
        logger.error(
          `[welcomeNewUser] Failed to send welcome email for user ${user.id}:`,
          err
        )
      })

    next()
  } catch (err) {
    logger.error(`[welcomeNewUser] Unexpected error:`, err)
    next()
  }
}

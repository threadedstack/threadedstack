import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import {
  ApprovedRole,
  WaitlistRole,
  WaitlistedCode,
  isFeatureEnabled,
} from '@tdsk/domain'

export const accessGate = async (req: TRequest, res: TResponse, next: NextFunction) => {
  try {
    if (!isFeatureEnabled(`accessGate`)) return next()

    if (res.locals.auth?.apiKeyId) return next()

    const user = req.user
    if (!user) return next()

    const role = user.role

    if (role === ApprovedRole) return next()

    if (role === WaitlistRole) {
      return res.status(403).json({ error: `Access pending`, code: WaitlistedCode })
    }

    const { db, email, config } = req.app.locals

    try {
      const { data: updated } = await db.services.user.update({
        id: user.id,
        role: WaitlistRole,
      } as any)

      if (updated)
        email
          .waitlistNotification({
            email: user.email,
            adminUrl: config.urls.admin,
            threadsUrl: config.urls.threads,
          })
          .catch((err: unknown) => {
            logger.error(
              `[accessGate] Failed to send waitlist email for user ${user.id}:`,
              err
            )
          })
    } catch (err: unknown) {
      logger.error(`[accessGate] Failed to set waitlist role for user ${user.id}:`, err)
    }

    return res.status(403).json({ error: `Access pending`, code: WaitlistedCode })
  } catch (err) {
    logger.error(`[accessGate] Unexpected error:`, err)
    next(err)
  }
}

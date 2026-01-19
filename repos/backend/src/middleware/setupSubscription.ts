import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'

import { logger } from '@TBE/utils/logger'

export const setupSubscription = async (
  req: TRequest,
  res: TResponse,
  next: NextFunction
) => {
  try {
    const userId = req.user?.id
    if (!userId) return next()

    const { db } = req.app.locals
    const { data, error } = await db.services.subscription.findByUser(userId)

    if (error) {
      logger.error(`Failed to check subscription:`, error)
      return next()
    }

    if (!data) {
      // Create free tier subscription if one does not exist
      const { error: createError } = await db.services.subscription.create({
        userId,
        tier: `free`,
        status: `active`,
      })

      createError && logger.error(`Failed to create free subscription:`, createError)
    }

    next()
  } catch (err) {
    logger.error(`Unexpected error in setupSubscription:`, err)
    next()
  }
}

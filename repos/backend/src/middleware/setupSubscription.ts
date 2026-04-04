import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'

import { logger } from '@TBE/utils/logger'

/**
 * Check if an error is a "not found" sentinel from the subscription service,
 * as opposed to an actual database failure.
 * The subscription.findByUser method returns { error: DBError("Subscription not found") }
 * when no row exists — this is expected for new users and should trigger free tier creation.
 */
const isNotFoundError = (error: unknown): boolean => {
  return error instanceof Error && error.message === `Subscription not found`
}

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

    // Distinguish "not found" (expected for new users) from real DB errors
    if (error && !isNotFoundError(error)) {
      logger.warn(`Failed to check subscription:`, error)
      res.locals.subscriptionError = true
      return next()
    }

    if (!data) {
      // Create free tier subscription if one does not exist
      const { error: createError } = await db.services.subscription.create({
        userId,
        tier: `free`,
        seats: 1,
        status: `active`,
      })

      if (createError) {
        logger.warn(`Failed to create free subscription:`, createError)
        res.locals.subscriptionError = true
      }
    }

    next()
  } catch (err) {
    logger.error(`Unexpected error in setupSubscription:`, err)
    res.locals.subscriptionError = true
    next()
  }
}

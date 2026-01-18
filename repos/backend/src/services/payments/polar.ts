import { app } from '@TBE/server/app'
import { logger } from '@TBE/utils/logger'

/**
 * TODO: temporary webhook handler until full service is written
 */
export const onPolarWebhook = async (payload: any) => {
  const db = app.locals.db
  if (!db) {
    logger.error('Database not initialized in app.locals')
    return
  }

  const subService = db.services.subscription

  switch (payload.type) {
    case `subscription.created`:
    case `subscription.updated`: {
      const sub = payload.data
      const metadata = sub.metadata || {}

      const userId = metadata.userId

      if (!userId) {
        logger.warn(`Received subscription event without userId in metadata: ${sub.id}`)
        return
      }

      await subService.upsert({
        userId: userId,
        polarId: sub.id,
        polarCustomerId: sub.customer_id,
        polarPriceId: sub.price_id,
        status: sub.status,
        // tier: tier, // Logic to determine tier
        currentPeriodStart: sub.current_period_start,
        currentPeriodEnd: sub.current_period_end,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
      })
      break
    }
  }
}

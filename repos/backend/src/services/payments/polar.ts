import { app } from '@TBE/server/app'
import { logger } from '@TBE/utils/logger'
import { PolarService } from './polarService'
import { config } from '@TBE/configs/backend.config'

/**
 * Webhook handler for Polar.sh subscription events
 */
export const onPolarWebhook = async (payload: any) => {
  const db = app.locals.db
  if (!db) {
    logger.error('Database not initialized in app.locals')
    return { error: new Error('Database not initialized') }
  }

  const subService = db.services.subscription
  const polarService = new PolarService(config.payments)

  try {
    switch (payload.type) {
      case `subscription.created`:
      case `subscription.updated`: {
        const sub = payload.data
        const metadata = sub.metadata || {}
        const userId = metadata.userId

        if (!userId) {
          logger.warn(`Received subscription event without userId in metadata: ${sub.id}`)
          return { error: new Error('Missing userId in metadata') }
        }

        // Determine tier from product ID
        const tier = polarService.getTierForProductId(sub.product_id) || 'free'

        const result = await subService.upsert({
          userId: userId,
          polarId: sub.id,
          polarCustomerId: sub.customer_id,
          polarPriceId: sub.price_id,
          status: sub.status,
          tier: tier,
          currentPeriodStart: sub.current_period_start,
          currentPeriodEnd: sub.current_period_end,
          cancelAtPeriodEnd: sub.cancel_at_period_end,
        })

        if (result.error) {
          logger.error('Failed to upsert subscription:', result.error)
          return { error: result.error }
        }

        logger.info(`Subscription ${sub.id} ${payload.type} for user ${userId}`)
        return { data: result.data }
      }

      case `subscription.cancelled`: {
        const sub = payload.data
        const metadata = sub.metadata || {}
        const userId = metadata.userId

        if (!userId) {
          logger.warn(`Received subscription cancelled event without userId: ${sub.id}`)
          return { error: new Error('Missing userId in metadata') }
        }

        const result = await subService.upsert({
          userId: userId,
          polarId: sub.id,
          status: 'cancelled',
          tier: 'free',
          cancelAtPeriodEnd: true,
        })

        if (result.error) {
          logger.error('Failed to cancel subscription:', result.error)
          return { error: result.error }
        }

        logger.info(`Subscription ${sub.id} cancelled for user ${userId}`)
        return { data: result.data }
      }

      default:
        logger.warn(`Unhandled webhook event type: ${payload.type}`)
        return { error: new Error(`Unhandled event type: ${payload.type}`) }
    }
  } catch (err: unknown) {
    logger.error('Error processing Polar webhook:', err)
    return { error: err as Error }
  }
}

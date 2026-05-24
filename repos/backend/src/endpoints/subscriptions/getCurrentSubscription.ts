import type { Response } from 'express'
import type { TEndpointConfig, TRequest, TPaySubscriptionState } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { Exception } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { reconcileSubscription } from '@TBE/utils/payments/reconcileSubscription'

/**
 * GET /subscriptions/current - Get current user's subscription
 * User-scoped: authentication is sufficient (no org role needed).
 *
 * When the user has a Stripe subscription, reconciles local state with Stripe
 * to catch any changes missed by webhooks (e.g. portal cancellations).
 */
export const getCurrentSubscription: TEndpointConfig = {
  path: `/current`,
  method: EPMethod.Get,
  action: async (req: TRequest, res: Response): Promise<void> => {
    const { db, payments } = req.app.locals
    const userId = req.user?.id

    if (!userId) throw new Exception(401, `Authentication required`)

    const { data, error } = await db.services.subscription.findByUser(userId)
    if (error) throw new Exception(500, error.message)

    if (!data?.stripeSubscriptionId) {
      res.status(200).json({ data: data ?? { userId, tier: `free`, status: `active` } })
      return
    }

    try {
      const remote = await payments.service.retrieveSubscription(
        data.stripeSubscriptionId
      )

      if (remote) {
        const updates = reconcileSubscription(data, remote)
        if (updates) {
          logger.info(
            `[getCurrentSubscription] Reconciling subscription for user ${userId}: ${JSON.stringify(updates)}`
          )
          const { data: updated, error: updateErr } =
            await db.services.subscription.upsertByUser({ userId, ...updates })

          if (updateErr)
            logger.error(
              `[getCurrentSubscription] Reconciliation update failed for user ${userId}:`,
              updateErr
            )
          else if (updated) {
            res.status(200).json({ data: updated })
            return
          }
        }
      }
    } catch (err) {
      logger.error(
        `[getCurrentSubscription] Stripe reconciliation failed for user ${userId}:`,
        err
      )
    }

    res.status(200).json({ data })
  },
}

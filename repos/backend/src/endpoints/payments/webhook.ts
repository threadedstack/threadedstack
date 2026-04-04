import type { TEndpointConfig } from '@TBE/types'

import { EPMethod } from '@TBE/types'
import { logger } from '@TBE/utils/logger'

/**
 * POST /payments/webhooks — Stripe webhook handler
 *
 * Uses the raw body buffer captured by the parent router's `express.json({ verify })`
 * middleware (stored as `req.rawBody`) for Stripe signature verification.
 * Falls back to `req.body` if rawBody is not available (e.g. when body was not JSON-parsed).
 *
 * Returns:
 * - 200 on successful processing
 * - 400 on missing signature or signature verification failure
 * - 500 on processing failures (so Stripe retries)
 */
export const webhook: TEndpointConfig = {
  path: `/webhooks`,
  method: EPMethod.Post,
  action: async (req, res): Promise<void> => {
    const { payments } = req.app.locals
    const signature = req.headers[`stripe-signature`] as string | undefined

    if (!signature) {
      res.status(400).json({ error: `Missing stripe-signature header` })
      return
    }

    // Use the raw body buffer captured by express.json({ verify }) for signature verification.
    // Falls back to req.body if rawBody is not set (e.g. in tests or non-JSON requests).
    const payload = (req as any).rawBody || req.body

    let event: any
    try {
      event = payments.service.constructWebhookEvent(payload, signature)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : `Webhook signature verification failed`
      logger.error(`[Webhook] Stripe signature verification failed:`, err)
      res.status(400).json({ error: message })
      return
    }

    try {
      await payments.service.webhook(req.app as any, event)
      res.status(200).json({ received: true })
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : `Webhook processing failed`
      logger.error(`[Webhook] Stripe webhook processing error:`, err)
      res.status(500).json({ error: message })
    }
  },
}

import { post } from './api-client'

/**
 * Probes the live webhook endpoint to determine whether Stripe signature
 * verification is enabled (webhookSecret configured) or skipped.
 *
 * Sends a benign event payload with a forged signature. If the response is
 * 200, verification is skipped; if 400, verification is enforced.
 *
 * Cached per-process so the probe only runs once per test run.
 */
let cachedMode: 'verify' | 'skip' | undefined

export const detectWebhookMode = async (): Promise<'verify' | 'skip'> => {
  if (cachedMode) return cachedMode

  const res = await post(
    '/payments/webhooks',
    { type: 'tdsk.webhook-mode-probe', data: {} },
    {
      headers: {
        'stripe-signature': `t=${Math.floor(Date.now() / 1000)},v1=${'0'.repeat(64)}`,
      },
    }
  )

  cachedMode = res.status === 200 ? 'skip' : 'verify'
  return cachedMode
}

export const isWebhookVerifyMode = async (): Promise<boolean> => {
  const mode = await detectWebhookMode()
  return mode === 'verify'
}

export const isWebhookSkipMode = async (): Promise<boolean> => {
  const mode = await detectWebhookMode()
  return mode === 'skip'
}

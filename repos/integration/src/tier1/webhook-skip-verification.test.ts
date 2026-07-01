import { describe, test, expect, beforeAll } from 'vitest'
import { post } from '../utils/api-client'
import { detectWebhookMode } from '../utils/webhook-helpers'

/**
 * Tier 1: Webhook Skip-Verification (Local Dev)
 *
 * Tests the skip-verification behavior when no webhookSecret is configured.
 * In non-production environments without a webhookSecret, signature verification
 * is skipped so `stripe listen` works without updating K8s secrets each session.
 *
 * When the env DOES have webhookSecret configured (the more common dev case
 * once a developer has linked their Stripe CLI), every forged-signature request
 * is rejected with 400 before the handler ever runs. The tests below assert
 * the right contract for whichever mode the live backend is currently in.
 *
 * Endpoint: POST /_/payments/webhooks (auto-prefixed by api-client)
 */
describe('Tier 1: Webhook Skip-Verification (Local Dev)', () => {
  let mode: 'verify' | 'skip'

  beforeAll(async () => {
    mode = await detectWebhookMode()
  })

  test('processes unrecognized events according to verification mode', async () => {
    const res = await post(
      '/payments/webhooks',
      { type: 'unrecognized.event.type', data: {} },
      { headers: { 'stripe-signature': 't=123,v1=anything' } }
    )

    if (mode === 'skip') {
      expect(res.ok).toBe(true)
      expect(res.status).toBe(200)
    } else {
      expect(res.ok).toBe(false)
      expect(res.status).toBe(400)
    }
  })

  test('still requires stripe-signature header even without verification', async () => {
    const res = await post('/payments/webhooks', { type: 'fake.event' })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('rejects empty stripe-signature header', async () => {
    const res = await post(
      '/payments/webhooks',
      { type: 'fake.event' },
      { headers: { 'stripe-signature': '' } }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })

  test('returns 500 for recognized event with invalid data when verification is skipped, 400 when enforced', async () => {
    const res = await post(
      '/payments/webhooks',
      { type: 'checkout.session.completed', data: { object: {} } },
      { headers: { 'stripe-signature': 't=123,v1=anything' } }
    )

    expect(res.ok).toBe(false)
    if (mode === 'skip') {
      expect(res.status).toBe(500)
    } else {
      expect(res.status).toBe(400)
    }
  })
})

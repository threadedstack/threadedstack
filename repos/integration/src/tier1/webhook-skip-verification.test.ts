import { describe, test, expect } from 'vitest'
import { post } from '../utils/api-client'

/**
 * Tier 1: Webhook Skip-Verification (Local Dev)
 *
 * Tests the skip-verification behavior when no webhookSecret is configured.
 * In non-production environments, signature verification is skipped so
 * `stripe listen` works without updating K8s secrets each session.
 *
 * Endpoint: POST /_/payments/webhooks (auto-prefixed by api-client)
 */
describe('Tier 1: Webhook Skip-Verification (Local Dev)', () => {

  test('processes unrecognized events when verification is skipped', async () => {
    const res = await post(
      '/payments/webhooks',
      { type: 'unrecognized.event.type', data: {} },
      { headers: { 'stripe-signature': 't=123,v1=anything' } }
    )

    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
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

  test('returns 500 for recognized event with invalid data', async () => {
    const res = await post(
      '/payments/webhooks',
      { type: 'checkout.session.completed', data: { object: {} } },
      { headers: { 'stripe-signature': 't=123,v1=anything' } }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(500)
  })
})

import { describe, test, expect } from 'vitest'
import { post } from '../utils/api-client'

/**
 * Tier 1: Webhook Security
 *
 * Tests that the Stripe webhook endpoint enforces header presence
 * and processes events correctly in skip-verification mode (no webhookSecret).
 * The endpoint is at /_/payments/webhooks (auto-prefixed by api-client).
 */
describe('Tier 1: Webhook Security', () => {

  test('POST /payments/webhooks with no stripe-signature returns 400', async () => {
    const res = await post('/payments/webhooks', { type: 'fake.event' })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    expect(res.error?.details).toHaveProperty('error')
  })

  test('POST /payments/webhooks with invalid stripe-signature processes unrecognized event', async () => {
    // With no webhookSecret configured, signature verification is skipped.
    // Unrecognized event types are logged and acknowledged with 200.
    const res = await post(
      '/payments/webhooks',
      { type: 'fake.event' },
      {
        headers: {
          'stripe-signature': 't=1234567890,v1=invalid_signature_value',
        },
      }
    )

    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
  })

  test('POST /payments/webhooks with empty body and no signature returns 400', async () => {
    const res = await post('/payments/webhooks', {})

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })
})

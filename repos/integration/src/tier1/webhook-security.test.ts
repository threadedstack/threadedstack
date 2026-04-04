import { describe, test, expect } from 'vitest'
import { post } from '../utils/api-client'

/**
 * Tier 1: Webhook Security
 *
 * Tests that the Stripe webhook endpoint rejects requests without
 * a valid stripe-signature header. The endpoint is at /_/payments/webhooks
 * (auto-prefixed by api-client).
 */
describe('Tier 1: Webhook Security', () => {

  test('POST /payments/webhooks with no stripe-signature returns 400', async () => {
    const res = await post('/payments/webhooks', { type: 'fake.event' })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    expect(res.data).toHaveProperty('error')
  })

  test('POST /payments/webhooks with invalid stripe-signature returns 400', async () => {
    const res = await post(
      '/payments/webhooks',
      { type: 'fake.event' },
      {
        headers: {
          'stripe-signature': 't=1234567890,v1=invalid_signature_value',
        },
      }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    expect(res.data).toHaveProperty('error')
  })

  test('POST /payments/webhooks with empty body and no signature returns 400', async () => {
    const res = await post('/payments/webhooks', {})

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })
})

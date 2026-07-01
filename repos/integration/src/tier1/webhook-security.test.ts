import { describe, test, expect, beforeAll } from 'vitest'
import { post } from '../utils/api-client'
import { detectWebhookMode } from '../utils/webhook-helpers'

/**
 * Tier 1: Webhook Security
 *
 * Tests that the Stripe webhook endpoint enforces header presence and handles
 * forged signatures correctly. Verification mode (webhookSecret on/off) is
 * detected at runtime so the tests assert the right contract for either mode.
 *
 * Endpoint: POST /_/payments/webhooks (auto-prefixed by api-client).
 */
describe('Tier 1: Webhook Security', () => {
  let mode: 'verify' | 'skip'

  beforeAll(async () => {
    mode = await detectWebhookMode()
  })

  test('POST /payments/webhooks with no stripe-signature returns 400', async () => {
    const res = await post('/payments/webhooks', { type: 'fake.event' })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    expect(res.error?.details).toHaveProperty('error')
  })

  test('POST /payments/webhooks with invalid stripe-signature responds per verification mode', async () => {
    const res = await post(
      '/payments/webhooks',
      { type: 'fake.event' },
      {
        headers: {
          'stripe-signature': 't=1234567890,v1=invalid_signature_value',
        },
      }
    )

    if (mode === 'skip') {
      expect(res.ok).toBe(true)
      expect(res.status).toBe(200)
    } else {
      expect(res.ok).toBe(false)
      expect(res.status).toBe(400)
    }
  })

  test('POST /payments/webhooks with empty body and no signature returns 400', async () => {
    const res = await post('/payments/webhooks', {})

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
  })
})

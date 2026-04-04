import { describe, test, expect } from 'vitest'
import { api } from '../utils/api-client'

/**
 * Tier 3: Webhook Security
 *
 * Tests that the Stripe webhook endpoint properly validates signatures.
 * All requests without valid Stripe signatures should be rejected with 400.
 *
 * The webhook endpoint is at /_/payments/webhooks and expects:
 * - Raw JSON body
 * - stripe-signature header with valid HMAC
 */
describe('Tier 3: Webhook Security', () => {

  test('POST /payments/webhooks — rejects request without signature header', async () => {
    const res = await api('/payments/webhooks', {
      method: 'POST',
      body: { type: 'checkout.session.completed', data: {} },
    })

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /payments/webhooks — rejects request with invalid signature', async () => {
    const res = await api('/payments/webhooks', {
      method: 'POST',
      body: { type: 'checkout.session.completed', data: {} },
      headers: {
        'stripe-signature': 't=1234567890,v1=invalid_signature_value',
      },
    })

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /payments/webhooks — rejects request with empty signature', async () => {
    const res = await api('/payments/webhooks', {
      method: 'POST',
      body: {
        id: 'evt_fake_123',
        type: 'invoice.payment_succeeded',
        data: { object: { customer: 'cus_fake' } },
      },
      headers: {
        'stripe-signature': '',
      },
    })

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /payments/webhooks — rejects valid-looking but forged signature', async () => {
    // Construct a signature that looks structurally valid but uses wrong key
    const timestamp = Math.floor(Date.now() / 1000)
    const fakePayload = JSON.stringify({ type: 'checkout.session.completed', data: {} })
    const fakeSignature = `t=${timestamp},v1=${'a'.repeat(64)}`

    const res = await api('/payments/webhooks', {
      method: 'POST',
      body: { type: 'checkout.session.completed', data: {} },
      headers: {
        'stripe-signature': fakeSignature,
      },
    })

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })
})

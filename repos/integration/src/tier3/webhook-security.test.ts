import { describe, test, expect } from 'vitest'
import { api } from '../utils/api-client'

/**
 * Tier 3: Webhook Security
 *
 * Tests that the Stripe webhook endpoint enforces header presence
 * and behaves correctly in skip-verification mode (no webhookSecret).
 *
 * The webhook endpoint is at /_/payments/webhooks and expects:
 * - Raw JSON body
 * - stripe-signature header (presence required, verification skipped when no secret)
 */
describe('Tier 3: Webhook Security', () => {

  test('POST /payments/webhooks rejects request without signature header', async () => {
    const res = await api('/payments/webhooks', {
      method: 'POST',
      body: { type: 'checkout.session.completed', data: {} },
    })

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /payments/webhooks accepts request with signature when verification is skipped', async () => {
    // In skip-verification mode, any signature header passes.
    // Unrecognized event types are logged and acknowledged.
    const res = await api('/payments/webhooks', {
      method: 'POST',
      body: { type: 'unrecognized.event', data: {} },
      headers: {
        'stripe-signature': 't=1234567890,v1=invalid_signature_value',
      },
    })

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
  })

  test('POST /payments/webhooks rejects request with empty signature', async () => {
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

  test('POST /payments/webhooks processes forged signature in skip-verification mode', async () => {
    // Structurally valid signature with wrong key is accepted when verification is skipped.
    const timestamp = Math.floor(Date.now() / 1000)
    const fakeSignature = `t=${timestamp},v1=${'a'.repeat(64)}`

    const res = await api('/payments/webhooks', {
      method: 'POST',
      body: { type: 'unrecognized.event', data: {} },
      headers: {
        'stripe-signature': fakeSignature,
      },
    })

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
  })
})

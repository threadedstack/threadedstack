import { describe, test, expect, beforeAll } from 'vitest'
import { api } from '../utils/api-client'
import { detectWebhookMode } from '../utils/webhook-helpers'

/**
 * Tier 3: Webhook Security
 *
 * Tests that the Stripe webhook endpoint enforces header presence and handles
 * forged signatures correctly. Verification mode (webhookSecret on/off) is
 * detected at runtime so the tests assert the right contract for either mode.
 *
 * The webhook endpoint is at /_/payments/webhooks and expects:
 * - Raw JSON body
 * - stripe-signature header (always required; verified only when webhookSecret is set)
 */
describe('Tier 3: Webhook Security', () => {
  let mode: 'verify' | 'skip'

  beforeAll(async () => {
    mode = await detectWebhookMode()
  })

  test('POST /payments/webhooks rejects request without signature header', async () => {
    const res = await api('/payments/webhooks', {
      method: 'POST',
      body: { type: 'checkout.session.completed', data: {} },
    })

    expect(res.status).toBe(400)
    expect(res.ok).toBe(false)
  })

  test('POST /payments/webhooks accepts forged signature per verification mode', async () => {
    const res = await api('/payments/webhooks', {
      method: 'POST',
      body: { type: 'unrecognized.event', data: {} },
      headers: {
        'stripe-signature': 't=1234567890,v1=invalid_signature_value',
      },
    })

    if (mode === 'skip') {
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
    } else {
      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    }
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

  test('POST /payments/webhooks processes structurally valid forged signature per verification mode', async () => {
    const timestamp = Math.floor(Date.now() / 1000)
    const fakeSignature = `t=${timestamp},v1=${'a'.repeat(64)}`

    const res = await api('/payments/webhooks', {
      method: 'POST',
      body: { type: 'unrecognized.event', data: {} },
      headers: {
        'stripe-signature': fakeSignature,
      },
    })

    if (mode === 'skip') {
      expect(res.status).toBe(200)
      expect(res.ok).toBe(true)
    } else {
      expect(res.status).toBe(400)
      expect(res.ok).toBe(false)
    }
  })
})

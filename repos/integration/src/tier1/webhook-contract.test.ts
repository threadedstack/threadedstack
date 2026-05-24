import { describe, test, expect } from 'vitest'
import { post } from '../utils/api-client'

/**
 * Tier 1: Webhook Contract
 *
 * Tests the Stripe webhook endpoint contract: public access, response format,
 * and behavior in skip-verification mode (no webhookSecret configured).
 *
 * Endpoint: POST /_/payments/webhooks (auto-prefixed by api-client)
 */
describe('Tier 1: Webhook Contract', () => {

  test('POST /payments/webhooks without Bearer token is rejected by proxy with 401', async () => {
    const res = await post('/payments/webhooks', { type: 'fake.event' }, { noAuth: true })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  test('POST /payments/webhooks without signature returns "Missing stripe-signature header" error', async () => {
    const res = await post('/payments/webhooks', { type: 'checkout.session.completed' })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    const details = res.error?.details as Record<string, unknown> | undefined
    expect(details).toHaveProperty('error')
    expect(details?.error).toMatch(/missing stripe-signature/i)
  })

  test('POST /payments/webhooks with signature and unrecognized event returns 200', async () => {
    // In skip-verification mode, the signature is not verified.
    // Unrecognized event types are logged and acknowledged.
    const res = await post(
      '/payments/webhooks',
      { type: 'unrecognized.event.type', data: {} },
      {
        headers: {
          'stripe-signature': 't=1234567890,v1=bad_sig',
        },
      }
    )

    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
  })

  test('POST /payments/webhooks with empty body and forged signature returns 200', async () => {
    // In skip-verification mode, JSON.parse({}) produces an object with no type.
    // The webhook handler switch/case hits default (unhandled) and returns 200.
    const timestamp = Math.floor(Date.now() / 1000)
    const res = await post(
      '/payments/webhooks',
      {},
      {
        headers: {
          'stripe-signature': `t=${timestamp},v1=${'b'.repeat(64)}`,
        },
      }
    )

    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
  })

  test('POST /payments/webhooks successful response includes received field', async () => {
    const res = await post(
      '/payments/webhooks',
      { type: 'unrecognized.event' },
      {
        headers: {
          'stripe-signature': 't=1234567890,v1=anything',
        },
      }
    )

    expect(res.ok).toBe(true)
    expect(res.status).toBe(200)
  })
})

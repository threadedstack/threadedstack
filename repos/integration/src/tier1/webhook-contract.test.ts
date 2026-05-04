import { describe, test, expect } from 'vitest'
import { post } from '../utils/api-client'

/**
 * Tier 1: Webhook Contract
 *
 * Tests the Stripe webhook endpoint contract — public access, response format,
 * and error message content. Complements webhook-security.test.ts which covers
 * signature rejection scenarios.
 *
 * Endpoint: POST /_/payments/webhooks (auto-prefixed by api-client)
 */
describe('Tier 1: Webhook Contract', () => {

  test('POST /payments/webhooks without Bearer token is rejected by proxy with 401', async () => {
    // Through the proxy, unauthenticated requests are rejected at the proxy layer
    // before reaching the backend's webhook handler. Stripe webhooks in production
    // bypass the proxy (direct backend access), but in integration tests all traffic
    // goes through the proxy, so we expect 401 here — not 400 from the webhook handler.
    const res = await post('/payments/webhooks', { type: 'fake.event' }, { noAuth: true })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })

  test('POST /payments/webhooks without signature returns "Missing stripe-signature header" error', async () => {
    const res = await post('/payments/webhooks', { type: 'checkout.session.completed' })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    // Backend returns { error: "Missing stripe-signature header" }
    // which api-client wraps into error.details
    const details = res.error?.details as Record<string, unknown> | undefined
    expect(details).toHaveProperty('error')
    expect(details?.error).toMatch(/missing stripe-signature/i)
  })

  test('POST /payments/webhooks with invalid signature returns signature verification error', async () => {
    const res = await post(
      '/payments/webhooks',
      { type: 'checkout.session.completed', data: {} },
      {
        headers: {
          'stripe-signature': 't=1234567890,v1=bad_sig',
        },
      }
    )

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    const details = res.error?.details as Record<string, unknown> | undefined
    expect(details).toHaveProperty('error')
    // Stripe SDK returns a verification failure message
    expect(details?.error).toBeTruthy()
  })

  test('POST /payments/webhooks with empty body and forged signature returns 400', async () => {
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

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    expect(res.error?.details).toHaveProperty('error')
  })

  test('POST /payments/webhooks error responses include an error field', async () => {
    // Verify the error response shape is consistent: { error: string }
    const res = await post('/payments/webhooks', { type: 'fake.event' })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    // The error details object must contain an `error` string field
    const details = res.error?.details as Record<string, unknown> | undefined
    expect(details).toBeDefined()
    expect(typeof details?.error).toBe('string')
    expect((details?.error as string)?.length).toBeGreaterThan(0)
  })
})

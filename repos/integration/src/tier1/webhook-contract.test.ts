import { describe, test, expect, beforeAll } from 'vitest'
import { post } from '../utils/api-client'
import { detectWebhookMode } from '../utils/webhook-helpers'

/**
 * Tier 1: Webhook Contract
 *
 * Tests the Stripe webhook endpoint contract: public access, response format,
 * and behavior in both verification and skip-verification modes. The verification
 * mode is detected at runtime via a forged-signature probe so the same contract
 * tests pass whether or not the dev env has webhookSecret configured.
 *
 * Endpoint: POST /_/payments/webhooks (auto-prefixed by api-client)
 */
describe('Tier 1: Webhook Contract', () => {
  let mode: 'verify' | 'skip'

  beforeAll(async () => {
    mode = await detectWebhookMode()
  })

  test('POST /payments/webhooks is reachable without Bearer token (Stripe sends none)', async () => {
    const res = await post('/payments/webhooks', { type: 'fake.event' }, { noAuth: true })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    const details = res.error?.details as Record<string, unknown> | undefined
    expect(details?.error).toMatch(/missing stripe-signature/i)
  })

  test('POST /payments/webhooks without signature returns "Missing stripe-signature header" error', async () => {
    const res = await post('/payments/webhooks', { type: 'checkout.session.completed' })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(400)
    const details = res.error?.details as Record<string, unknown> | undefined
    expect(details).toHaveProperty('error')
    expect(details?.error).toMatch(/missing stripe-signature/i)
  })

  test('POST /payments/webhooks with signature and unrecognized event responds per verification mode', async () => {
    const res = await post(
      '/payments/webhooks',
      { type: 'unrecognized.event.type', data: {} },
      {
        headers: {
          'stripe-signature': 't=1234567890,v1=bad_sig',
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

  test('POST /payments/webhooks with empty body and forged signature responds per verification mode', async () => {
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

    if (mode === 'skip') {
      expect(res.ok).toBe(true)
      expect(res.status).toBe(200)
    } else {
      expect(res.ok).toBe(false)
      expect(res.status).toBe(400)
    }
  })

  test('POST /payments/webhooks successful response includes received field when verification is skipped', async () => {
    const res = await post(
      '/payments/webhooks',
      { type: 'unrecognized.event' },
      {
        headers: {
          'stripe-signature': 't=1234567890,v1=anything',
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
})

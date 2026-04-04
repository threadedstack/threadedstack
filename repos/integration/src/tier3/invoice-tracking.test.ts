import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'
import { readContext } from '../utils/test-context'

/**
 * Tier 3: Invoice Tracking
 *
 * Tests the invoices endpoint which returns the user's billing invoices.
 * The invoices are stored locally (synced from Stripe via webhooks).
 */
describe('Tier 3: Invoice Tracking', () => {
  const ctx = readContext()

  test('GET /subscriptions/invoices — returns array', async () => {
    const res = await get<{ data: Array<Record<string, unknown>> }>(
      '/subscriptions/invoices'
    )

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)

    // The data should be an array (may be empty for free tier users)
    expect(Array.isArray(res.data.data)).toBe(true)
  })

  test('GET /subscriptions/invoices — items have correct shape when present', async () => {
    const res = await get<{ data: Array<Record<string, unknown>> }>(
      '/subscriptions/invoices'
    )

    expect(res.status).toBe(200)
    const invoices = res.data.data

    if (invoices.length === 0) {
      // No invoices — expected for free tier test users
      return
    }

    // Verify invoice shape matches the Invoice model
    for (const invoice of invoices) {
      // Core fields that should exist on every invoice
      expect(invoice).toHaveProperty('id')

      // Amount should be a number
      if (invoice.amount !== undefined && invoice.amount !== null) {
        expect(typeof invoice.amount).toBe('number')
      }

      // Status should be a string (paid, open, void, etc.)
      if (invoice.status !== undefined && invoice.status !== null) {
        expect(typeof invoice.status).toBe('string')
      }

      // invoiceUrl should be a string URL when present
      if (invoice.invoiceUrl !== undefined && invoice.invoiceUrl !== null) {
        expect(typeof invoice.invoiceUrl).toBe('string')
      }
    }
  })

  test('GET /subscriptions/invoices — requires authentication', async () => {
    const res = await get('/subscriptions/invoices', { noAuth: true })

    expect(res.ok).toBe(false)
    expect(res.status).toBe(401)
  })
})

import { describe, test, expect } from 'vitest'
import { get } from '../utils/api-client'

/**
 * Tier 1: Invoice Tracking
 *
 * Tests that the invoices endpoint returns the expected shape.
 * For free-tier users there may be no invoices; the endpoint should
 * still return 200 with an empty array.
 */
describe('Tier 1: Invoice Tracking', () => {

  test('GET /subscriptions/invoices returns 200 with array', async () => {
    const res = await get<unknown[]>('/subscriptions/invoices')

    expect(res.status).toBe(200)
    expect(res.ok).toBe(true)
    expect(Array.isArray(res.data)).toBe(true)
  })

  test('GET /subscriptions/invoices items have expected shape when present', async () => {
    const res = await get<Array<{
        amount: number
        status: string
        period: string
        invoiceUrl: string | null
      }>>('/subscriptions/invoices')

    expect(res.status).toBe(200)

    const invoices = res.data

    // If there are invoices, validate the shape of each one
    for (const invoice of invoices) {
      expect(typeof invoice.amount).toBe('number')
      expect(typeof invoice.status).toBe('string')
      expect(typeof invoice.period).toBe('string')
      // invoiceUrl can be string or null
      expect(invoice.invoiceUrl === null || typeof invoice.invoiceUrl === 'string').toBe(true)
    }
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQueryFetch = vi.fn((opts: any) => opts.queryFn())

vi.mock(`@TAF/services/tokenRefresh`, () => ({
  tokenRefresh: {
    refreshAndRetry: vi.fn(),
  },
}))

vi.mock(`@TAF/services/auth`, () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { token: `test` }, user: { id: `u1` } },
    }),
  },
}))

vi.mock(`@TAF/utils/api/apiUrl`, () => ({
  apiUrl: () => `http://test.local`,
}))

vi.mock(`@TAF/services/query`, () => ({
  query: {
    fetch: (opts: any) => mockQueryFetch(opts),
    options: vi.fn((o: any) => o),
  },
}))

vi.unmock(`@TAF/services/api`)

import { Plan, Invoice, Subscription } from '@tdsk/domain'
import { subscriptionsApi } from './subscriptionsApi'

describe(`SubscriptionsApi`, () => {
  let mockFetch: ReturnType<typeof vi.fn>
  let onErrorSpy: ReturnType<typeof vi.spyOn>

  const makeResponse = (status: number, body: any = {}) =>
    new Response(JSON.stringify(body), {
      status,
      statusText: status < 400 ? `OK` : `Error`,
      headers: { [`Content-Type`]: `application/json` },
    })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.fn()
    subscriptionsApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(subscriptionsApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`current()`, () => {
    it(`should GET /subscriptions/current and wrap the response as a Subscription`, async () => {
      const row = { id: `s1`, tier: `pro` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const resp = await subscriptionsApi.current()

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/subscriptions/current`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toBeInstanceOf(Subscription)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      const resp = await subscriptionsApi.current()

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with the current-subscription failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await subscriptionsApi.current()

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load subscription`
      )
    })
  })

  describe(`plans()`, () => {
    it(`should GET /subscriptions/plans and wrap each row as a Plan`, async () => {
      const rows = [
        { id: `free`, price: 0 },
        { id: `pro`, price: 149 },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await subscriptionsApi.plans()

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/subscriptions/plans`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Plan)
    })

    it(`should fall back to an empty array when resp.data is null`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await subscriptionsApi.plans()

      expect(resp.data).toEqual([])
    })

    it(`should fall back to an empty array without throwing when the response body has no data field (resp.data is a non-array object, not falsy)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, {}))

      const resp = await subscriptionsApi.plans()

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with the plans failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await subscriptionsApi.plans()

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load payment plans`
      )
    })
  })

  describe(`checkout()`, () => {
    it(`should POST to /subscriptions/checkout with the body`, async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse(200, { data: { url: `https://checkout` } })
      )

      const payload = {
        tier: `pro`,
        successUrl: `https://ok`,
        cancelUrl: `https://cancel`,
      } as const
      const resp = await subscriptionsApi.checkout(payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/subscriptions/checkout`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toEqual({ url: `https://checkout` })
    })

    it(`should call _onError with the checkout failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await subscriptionsApi.checkout({
        tier: `pro`,
        successUrl: `https://ok`,
        cancelUrl: `https://cancel`,
      })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to create checkout session`
      )
    })
  })

  describe(`portal()`, () => {
    it(`should POST to /subscriptions/portal`, async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse(200, { data: { url: `https://portal` } })
      )

      const resp = await subscriptionsApi.portal()

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/subscriptions/portal`)
      expect(init.method).toBe(`POST`)
      expect(resp.data).toEqual({ url: `https://portal` })
    })

    it(`should call _onError with the portal failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await subscriptionsApi.portal()

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to create portal session`
      )
    })
  })

  describe(`invoices()`, () => {
    it(`should GET /subscriptions/invoices and wrap each row as an Invoice`, async () => {
      const rows = [
        { id: `i1`, amount: 149 },
        { id: `i2`, amount: 39 },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await subscriptionsApi.invoices()

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/subscriptions/invoices`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Invoice)
    })

    it(`should fall back to an empty array when resp.data is null`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await subscriptionsApi.invoices()

      expect(resp.data).toEqual([])
    })

    it(`should fall back to an empty array without throwing when the response body has no data field (resp.data is a non-array object, not falsy)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, {}))

      const resp = await subscriptionsApi.invoices()

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with the invoices failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await subscriptionsApi.invoices()

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load invoices`
      )
    })
  })

  describe(`cancel()`, () => {
    it(`should DELETE /subscriptions/current`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await subscriptionsApi.cancel()

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/subscriptions/current`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with the cancel failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await subscriptionsApi.cancel()

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to cancel subscription`
      )
    })
  })
})

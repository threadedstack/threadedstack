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

import { quotasApi } from './quotasApi'

describe(`QuotasApi`, () => {
  let mockFetch: ReturnType<typeof vi.fn>

  const makeResponse = (status: number, body: any = {}) =>
    new Response(JSON.stringify(body), {
      status,
      statusText: status < 400 ? `OK` : `Error`,
      headers: { [`Content-Type`]: `application/json` },
    })

  beforeEach(() => {
    vi.clearAllMocks()
    mockFetch = vi.fn()
    quotasApi.api.mock = mockFetch as any
  })

  describe(`get()`, () => {
    it(`should GET quota usage, use cache.usage(orgId) as queryKey, staleTime 30000ms, and return the response as-is`, async () => {
      const usage = {
        orgId: `org-1`,
        period: `2026-07`,
        projects: 2,
        compute: 10,
        threads: 5,
        messages: 100,
        endpoints: 3,
        secrets: 1,
        sandboxSessions: 4,
      }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: usage }))

      const resp = await quotasApi.get({ orgId: `org-1` })

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/quotas`)
      expect(init.method).toBe(`GET`)

      expect(mockQueryFetch).toHaveBeenCalledOnce()
      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(quotasApi.cache.usage(`org-1`))
      expect(queryOpts.staleTime).toBe(30000)

      expect(resp.data).toEqual(usage)
    })

    it(`should fire _onError with 'Failed to load quota usage' when resp.error is present`, async () => {
      const onErrorSpy = vi.spyOn(quotasApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      const resp = await quotasApi.get({ orgId: `org-1` })

      expect(resp.error).toBeDefined()
      expect(onErrorSpy).toHaveBeenCalledOnce()
      expect(onErrorSpy).toHaveBeenCalledWith(resp.error, `Failed to load quota usage`)
    })
  })

  describe(`limits()`, () => {
    it(`should GET quota limits, use cache.limits(orgId) as queryKey, staleTime 60000ms, and return the response as-is`, async () => {
      const limits = { projects: 10, compute: 100, threads: 50 }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: limits }))

      const resp = await quotasApi.limits({ orgId: `org-1` })

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/quotas/limits`)
      expect(init.method).toBe(`GET`)

      expect(mockQueryFetch).toHaveBeenCalledOnce()
      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(quotasApi.cache.limits(`org-1`))
      expect(queryOpts.staleTime).toBe(60000)

      expect(resp.data).toEqual(limits)
    })

    it(`should fire _onError with 'Failed to load quota limits' when resp.error is present`, async () => {
      const onErrorSpy = vi.spyOn(quotasApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      const resp = await quotasApi.limits({ orgId: `org-1` })

      expect(resp.error).toBeDefined()
      expect(onErrorSpy).toHaveBeenCalledOnce()
      expect(onErrorSpy).toHaveBeenCalledWith(resp.error, `Failed to load quota limits`)
    })
  })

  describe(`check()`, () => {
    it(`should POST to /orgs/:orgId/quotas/check with the full data object (including orgId) as the body`, async () => {
      const result = { limit: 10, current: 3, allowed: true, remaining: 7 }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: result }))

      const payload = { orgId: `org-1`, resource: `projects`, amount: 1 }
      const resp = await quotasApi.check(payload)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/quotas/check`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)

      expect(resp.data).toEqual(result)
    })

    it(`should fire _onError with 'Failed to check quota' when resp.error is present`, async () => {
      const onErrorSpy = vi.spyOn(quotasApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      const resp = await quotasApi.check({ orgId: `org-1`, resource: `projects` })

      expect(resp.error).toBeDefined()
      expect(onErrorSpy).toHaveBeenCalledOnce()
      expect(onErrorSpy).toHaveBeenCalledWith(resp.error, `Failed to check quota`)
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() returns ['/quotas']`, () => {
      expect(quotasApi.cache.all()).toEqual([`/quotas`])
    })

    it(`cache.usage(orgId) extends cache.all() with ['usage', orgId]`, () => {
      expect(quotasApi.cache.usage(`org-1`)).toEqual([`/quotas`, `usage`, `org-1`])
    })

    it(`cache.limits(orgId) extends cache.all() with ['limits', orgId]`, () => {
      expect(quotasApi.cache.limits(`org-1`)).toEqual([`/quotas`, `limits`, `org-1`])
    })
  })
})

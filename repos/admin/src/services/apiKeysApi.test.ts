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

import { ApiKey } from '@tdsk/domain'
import { apiKeysApi } from './apiKeysApi'

describe(`ApiKeysApi`, () => {
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
    apiKeysApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(apiKeysApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`list()`, () => {
    it(`should GET the org-scoped path and use cache.list() as queryKey when no data is passed`, async () => {
      const rows = [
        { id: `k1`, name: `A` },
        { id: `k2`, name: `B` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await apiKeysApi.list(`org-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/api-keys`)
      expect(init.method).toBe(`GET`)

      expect(mockQueryFetch).toHaveBeenCalledOnce()
      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(apiKeysApi.cache.list())

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(ApiKey)
      expect(resp.data![0].id).toBe(`k1`)
    })

    it(`should re-add userId alongside the rest of data as query params and use cache.list(userId) as queryKey when userId is present`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await apiKeysApi.list(`org-1`, { userId: `u1`, limit: 10 })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain(`userId=u1`)
      expect(url).toContain(`limit=10`)

      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(apiKeysApi.cache.list(`u1`))
    })

    it(`should use the plain cache.list() form (no userId arg) when userId is absent`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await apiKeysApi.list(`org-1`, { limit: 10 })

      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(apiKeysApi.cache.list())
    })

    it(`should let an explicit data.queryKey override the default`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      const customKey = [`custom`, `key`] as const
      await apiKeysApi.list(`org-1`, { queryKey: customKey })

      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(customKey)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, {}))

      const resp = await apiKeysApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with the list failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await apiKeysApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load API keys list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET /api-keys/:id and wrap the response as an ApiKey`, async () => {
      const row = { id: `k1`, name: `A` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const resp = await apiKeysApi.get(`org-1`, `k1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/api-keys/k1`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toBeInstanceOf(ApiKey)
      expect(resp.data!.id).toBe(`k1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      const resp = await apiKeysApi.get(`org-1`, `missing`)

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with the get failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await apiKeysApi.get(`org-1`, `missing`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to load API key`)
    })
  })

  describe(`create()`, () => {
    it(`should POST to the base path with the body and wrap the response`, async () => {
      const row = { id: `k1`, name: `New`, key: `tdsk_raw` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { name: `New` }
      const resp = await apiKeysApi.create(`org-1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/api-keys`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(ApiKey)
      expect(resp.data!.id).toBe(`k1`)
      expect(resp.data!.key).toBe(`tdsk_raw`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      const resp = await apiKeysApi.create(`org-1`, { name: `New` })

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with the create failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await apiKeysApi.create(`org-1`, { name: `New` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to create API key`
      )
    })
  })

  describe(`update()`, () => {
    it(`should PUT to /api-keys/:id with the body and wrap the response`, async () => {
      const row = { id: `k1`, name: `Updated` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { name: `Updated` }
      const resp = await apiKeysApi.update(`org-1`, `k1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/api-keys/k1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(ApiKey)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      const resp = await apiKeysApi.update(`org-1`, `k1`, { name: `x` })

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with the update failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await apiKeysApi.update(`org-1`, `k1`, { name: `x` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to update API key`
      )
    })
  })

  describe(`revoke()`, () => {
    it(`should DELETE /api-keys/:id and return the raw response with no ApiKey wrapping`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await apiKeysApi.revoke(`org-1`, `k1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/api-keys/k1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
      expect(resp.data).not.toBeInstanceOf(ApiKey)
    })

    it(`should call _onError with the revoke failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await apiKeysApi.revoke(`org-1`, `k1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to revoke API key`
      )
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() returns ['/api-keys']`, () => {
      expect(apiKeysApi.cache.all()).toEqual([`/api-keys`])
    })

    it(`cache.list() with no userId extends cache.all() with ['list']`, () => {
      expect(apiKeysApi.cache.list()).toEqual([`/api-keys`, `list`])
    })

    it(`cache.list(userId) extends cache.all() with ['list', userId]`, () => {
      expect(apiKeysApi.cache.list(`u1`)).toEqual([`/api-keys`, `list`, `u1`])
    })

    it(`cache.detail(id) extends cache.all() with ['detail', id]`, () => {
      expect(apiKeysApi.cache.detail(`k1`)).toEqual([`/api-keys`, `detail`, `k1`])
    })
  })
})

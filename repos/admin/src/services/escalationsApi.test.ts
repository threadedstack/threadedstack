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

import { Escalation } from '@tdsk/domain'
import { escalationsApi } from './escalationsApi'

describe(`EscalationsApi`, () => {
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
    escalationsApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET the org-scoped path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await escalationsApi.list(`org-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/escalations`)
      expect(init.method).toBe(`GET`)
    })

    it(`should map each row into an Escalation instance`, async () => {
      const rows = [
        { id: `s-1`, orgId: `org-1` },
        { id: `s-2`, orgId: `org-1` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await escalationsApi.list(`org-1`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Escalation)
      expect(resp.data![0].id).toBe(`s-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await escalationsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should not throw and should fall back to an empty array when the response body has no top-level 'data' key (parseResponse returns the raw non-array body as resp.data)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { notData: true }))

      const resp = await escalationsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should use data.queryKey to override the default cache.list() key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await escalationsApi.list(`org-1`, { queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should default the cache.list() key scope to org`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await escalationsApi.list(`org-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: escalationsApi.cache.list(`org-1`) })
      )
    })

    it(`should call _onError with 'Failed to load Escalations list' on error`, async () => {
      const onErrorSpy = vi.spyOn(escalationsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await escalationsApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Escalations list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET the escalation by id and map to an Escalation instance`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `s-1` } }))

      const resp = await escalationsApi.get(`org-1`, `s-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/escalations/s-1`)
      expect(resp.data).toBeInstanceOf(Escalation)
    })

    it(`should call _onError with 'Failed to load Escalation' on error`, async () => {
      const onErrorSpy = vi.spyOn(escalationsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await escalationsApi.get(`org-1`, `s-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Escalation`
      )
    })
  })

  describe(`resolve()`, () => {
    it(`should POST a resolution and map the response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `s-1` } }))

      const resp = await escalationsApi.resolve(`org-1`, `s-1`, { status: `resolved` })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/escalations/s-1/resolve`)
      expect(init.method).toBe(`POST`)
      expect(resp.data).toBeInstanceOf(Escalation)
    })

    it(`should call _onError with 'Failed to resolve Escalation' on error`, async () => {
      const onErrorSpy = vi.spyOn(escalationsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await escalationsApi.resolve(`org-1`, `s-1`, { status: `rejected`, reason: `no` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to resolve Escalation`
      )
    })
  })
})

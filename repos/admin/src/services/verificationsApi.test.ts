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

import { Verification } from '@tdsk/domain'
import { verificationsApi } from './verificationsApi'

describe(`VerificationsApi`, () => {
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
    verificationsApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(verificationsApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`list()`, () => {
    it(`should GET the org verifications path and wrap each row as a Verification`, async () => {
      const rows = [{ id: `v1` }, { id: `v2` }]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await verificationsApi.list(`org-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/verifications`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Verification)
    })

    it(`should fall back to an empty array when resp.data is null`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await verificationsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should fall back to an empty array without throwing when the response body has no data field (resp.data is a non-array object, not falsy)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, {}))

      const resp = await verificationsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should let an explicit data.queryKey override the default cache.list key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await verificationsApi.list(`org-1`, { queryKey: [`custom`, `key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom`, `key`] })
      )
    })

    it(`should call _onError with the list failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await verificationsApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Verifications list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET /verifications/:id and wrap the response as a Verification`, async () => {
      const row = { id: `v1` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const resp = await verificationsApi.get(`org-1`, `v1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/verifications/v1`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toBeInstanceOf(Verification)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      const resp = await verificationsApi.get(`org-1`, `missing`)

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with the get failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await verificationsApi.get(`org-1`, `missing`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Verification`
      )
    })
  })
})

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

import { OpsAction } from '@tdsk/domain'
import { opsActionsApi } from './opsActionsApi'

describe(`OpsActionsApi`, () => {
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
    opsActionsApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET the org-scoped path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await opsActionsApi.list(`org-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/ops-actions`)
      expect(init.method).toBe(`GET`)
    })

    it(`should map each row into an OpsAction instance`, async () => {
      const rows = [
        { id: `o-1`, orgId: `org-1` },
        { id: `o-2`, orgId: `org-1` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await opsActionsApi.list(`org-1`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(OpsAction)
      expect(resp.data![0].id).toBe(`o-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await opsActionsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should not throw and should fall back to an empty array when the response body has no top-level 'data' key (parseResponse returns the raw non-array body as resp.data)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { notData: true }))

      const resp = await opsActionsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should use data.queryKey to override the default cache.list() key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await opsActionsApi.list(`org-1`, { queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should default the cache.list() key scope to org`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await opsActionsApi.list(`org-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: opsActionsApi.cache.list(`org-1`) })
      )
    })

    it(`should call _onError with 'Failed to load Ops Actions list' on error`, async () => {
      const onErrorSpy = vi.spyOn(opsActionsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await opsActionsApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Ops Actions list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET the ops action by id and map to an OpsAction instance`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `o-1` } }))

      const resp = await opsActionsApi.get(`org-1`, `o-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/ops-actions/o-1`)
      expect(resp.data).toBeInstanceOf(OpsAction)
    })

    it(`should call _onError with 'Failed to load Ops Action' on error`, async () => {
      const onErrorSpy = vi.spyOn(opsActionsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await opsActionsApi.get(`org-1`, `o-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Ops Action`
      )
    })
  })

  describe(`override()`, () => {
    it(`should POST an override decision and map the response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `o-1` } }))

      const resp = await opsActionsApi.override(`org-1`, `o-1`, { approve: true })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/ops-actions/o-1/override`)
      expect(init.method).toBe(`POST`)
      expect(resp.data).toBeInstanceOf(OpsAction)
    })

    it(`should call _onError with 'Failed to override Ops Action' on error`, async () => {
      const onErrorSpy = vi.spyOn(opsActionsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await opsActionsApi.override(`org-1`, `o-1`, { approve: false, reason: `no` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to override Ops Action`
      )
    })
  })
})

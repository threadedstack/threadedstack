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

import { Endpoint } from '@tdsk/domain'
import { endpointsApi } from './endpointsApi'

describe(`EndpointsApi`, () => {
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
    endpointsApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET the project-scoped path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await endpointsApi.list(`org-1`, `proj-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/endpoints`)
      expect(init.method).toBe(`GET`)
    })

    it(`should map each row into an Endpoint instance`, async () => {
      const rows = [
        { id: `e-1`, name: `one`, projectId: `proj-1` },
        { id: `e-2`, name: `two`, projectId: `proj-1` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await endpointsApi.list(`org-1`, `proj-1`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Endpoint)
      expect(resp.data![0].id).toBe(`e-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await endpointsApi.list(`org-1`, `proj-1`)

      expect(resp.data).toEqual([])
    })

    it(`should not throw and should fall back to an empty array when the response body has no top-level 'data' key (parseResponse returns the raw non-array body as resp.data)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { notData: true }))

      const resp = await endpointsApi.list(`org-1`, `proj-1`)

      expect(resp.data).toEqual([])
    })

    it(`should use data.queryKey to override the default cache.list() key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await endpointsApi.list(`org-1`, `proj-1`, { queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should default the cache.list() key scope to org/project`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await endpointsApi.list(`org-1`, `proj-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: endpointsApi.cache.list(`org-1`, `proj-1`) })
      )
    })

    it(`should call _onError with 'Failed to load Endpoints list' on error`, async () => {
      const onErrorSpy = vi.spyOn(endpointsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await endpointsApi.list(`org-1`, `proj-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Endpoints list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET the endpoint by id and map to an Endpoint instance`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `e-1` } }))

      const resp = await endpointsApi.get(`org-1`, `proj-1`, `e-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/endpoints/e-1`)
      expect(resp.data).toBeInstanceOf(Endpoint)
    })

    it(`should call _onError with 'Failed to load Endpoint' on error`, async () => {
      const onErrorSpy = vi.spyOn(endpointsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await endpointsApi.get(`org-1`, `proj-1`, `e-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Endpoint`
      )
    })
  })

  describe(`create()`, () => {
    it(`should POST new endpoint data and map the response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `e-1` } }))

      const resp = await endpointsApi.create(`org-1`, `proj-1`, { name: `new` })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/endpoints`)
      expect(init.method).toBe(`POST`)
      expect(resp.data).toBeInstanceOf(Endpoint)
    })
  })

  describe(`update()`, () => {
    it(`should PUT updated endpoint data and map the response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `e-1` } }))

      const resp = await endpointsApi.update(`org-1`, `proj-1`, `e-1`, {
        name: `updated`,
      })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/endpoints/e-1`)
      expect(init.method).toBe(`PUT`)
      expect(resp.data).toBeInstanceOf(Endpoint)
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE the endpoint by id`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      await endpointsApi.delete(`org-1`, `proj-1`, `e-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/endpoints/e-1`)
      expect(init.method).toBe(`DELETE`)
    })

    it(`should call _onError with 'Failed to delete Endpoint' on error`, async () => {
      const onErrorSpy = vi.spyOn(endpointsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await endpointsApi.delete(`org-1`, `proj-1`, `e-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to delete Endpoint`
      )
    })
  })
})

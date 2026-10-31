import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock(`@TTH/services/tokenRefresh`, () => ({
  tokenRefresh: {
    refreshAndRetry: vi.fn(),
  },
}))

vi.mock(`@TTH/services/auth`, () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { token: `test` }, user: { id: `u1` } },
    }),
  },
}))

vi.mock(`@TTH/utils/api/apiUrl`, () => ({
  apiUrl: () => `http://test.local`,
}))

const mockQueryFetch = vi.fn((opts: any) => opts.queryFn())

vi.mock(`@TTH/services/query`, () => ({
  query: {
    fetch: (opts: any) => mockQueryFetch(opts),
    options: vi.fn((o: any) => o),
  },
}))

// Unmock api.ts so we test the real class (setupTests.ts auto-mocks it globally)
vi.mock(`@TTH/services/api`, async () => {
  const actual = await vi.importActual<typeof import('./api')>(`@TTH/services/api`)
  return actual
})

import { collectionApi } from './collectionApi'

describe(`CollectionApi`, () => {
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
    collectionApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(collectionApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`list()`, () => {
    it(`should GET the project-scoped path, use cache.list(orgId, projectId) as the queryKey, and return the raw data array`, async () => {
      const rows = [
        { id: `c1`, name: `A`, recordCount: 3 },
        { id: `c2`, name: `B`, recordCount: 0 },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await collectionApi.list(`org-1`, `proj-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/collections`)
      expect(init.method).toBe(`GET`)

      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(collectionApi.cache.list(`org-1`, `proj-1`))

      expect(resp.data).toEqual(rows)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await collectionApi.list(`org-1`, `proj-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with 'Failed to load Collections list' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await collectionApi.list(`org-1`, `proj-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Collections list`
      )
    })
  })

  describe(`create()`, () => {
    it(`should POST to the base scoped path with the body and return the response unwrapped`, async () => {
      const row = { id: `c1`, name: `New` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { name: `New` }
      const resp = await collectionApi.create(`org-1`, `proj-1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/collections`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toEqual(row)
    })

    it(`should call _onError with 'Failed to create Collection' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await collectionApi.create(`org-1`, `proj-1`, { name: `New` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to create Collection`
      )
    })
  })

  describe(`update()`, () => {
    it(`should PUT to the path with the collection name appended and return the response unwrapped`, async () => {
      const row = { id: `c1`, name: `Renamed` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { name: `Renamed` }
      const resp = await collectionApi.update(`org-1`, `proj-1`, `Old`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/collections/Old`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toEqual(row)
    })

    it(`should call _onError with 'Failed to update Collection' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await collectionApi.update(`org-1`, `proj-1`, `Old`, { name: `x` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to update Collection`
      )
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE the path with the collection name appended and return the raw {success} response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await collectionApi.delete(`org-1`, `proj-1`, `Old`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/collections/Old`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with 'Failed to delete Collection' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await collectionApi.delete(`org-1`, `proj-1`, `Old`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to delete Collection`
      )
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() returns ['collections']`, () => {
      expect(collectionApi.cache.all()).toEqual([`collections`])
    })

    it(`cache.list(orgId, projectId) extends cache.all() with ['list', orgId, projectId]`, () => {
      expect(collectionApi.cache.list(`org-1`, `proj-1`)).toEqual([
        `collections`,
        `list`,
        `org-1`,
        `proj-1`,
      ])
    })

    it(`cache.detail(id) extends cache.all() with ['detail', id]`, () => {
      expect(collectionApi.cache.detail(`c1`)).toEqual([`collections`, `detail`, `c1`])
    })
  })
})

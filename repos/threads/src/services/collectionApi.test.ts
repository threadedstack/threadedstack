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

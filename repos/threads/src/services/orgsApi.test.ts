import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQueryFetch = vi.fn((opts: any) => opts.queryFn())

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

vi.mock(`@TTH/services/query`, () => ({
  query: {
    fetch: (opts: any) => mockQueryFetch(opts),
    options: vi.fn((o: any) => o),
  },
}))

vi.unmock(`@TTH/services/api`)

import { Organization } from '@tdsk/domain'
import { orgsApi } from './orgsApi'

describe(`OrgsApi`, () => {
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
    orgsApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET the orgs path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await orgsApi.list()

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs`)
      expect(init.method).toBe(`GET`)
    })

    it(`should map each row into an Organization instance`, async () => {
      const rows = [
        { id: `org-1`, name: `one` },
        { id: `org-2`, name: `two` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await orgsApi.list()

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Organization)
      expect(resp.data![0].id).toBe(`org-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await orgsApi.list()

      expect(resp.data).toEqual([])
    })

    it(`should use cache.list() as the queryKey`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await orgsApi.list()

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: orgsApi.cache.list() })
      )
    })

    it(`should call _onError with 'Failed to load organizations' on error`, async () => {
      const onErrorSpy = vi.spyOn(orgsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await orgsApi.list()

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load organizations`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET the org detail path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `org-1` } }))

      await orgsApi.get(`org-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1`)
      expect(init.method).toBe(`GET`)
    })

    it(`should map the response into an Organization instance`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `org-1` } }))

      const resp = await orgsApi.get(`org-1`)

      expect(resp.data).toBeInstanceOf(Organization)
      expect(resp.data?.id).toBe(`org-1`)
    })

    it(`should use cache.detail(id) as the queryKey`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `org-1` } }))

      await orgsApi.get(`org-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: orgsApi.cache.detail(`org-1`) })
      )
    })

    it(`should fall back to undefined when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await orgsApi.get(`org-1`)

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to load organization <id>' on error`, async () => {
      const onErrorSpy = vi.spyOn(orgsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await orgsApi.get(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load organization org-1`
      )
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() returns ['orgs']`, () => {
      expect(orgsApi.cache.all()).toEqual([`orgs`])
    })

    it(`cache.list() extends cache.all() with ['list']`, () => {
      expect(orgsApi.cache.list()).toEqual([`orgs`, `list`])
    })

    it(`cache.detail(id) extends cache.all() with ['detail', id]`, () => {
      expect(orgsApi.cache.detail(`org-1`)).toEqual([`orgs`, `detail`, `org-1`])
    })
  })
})

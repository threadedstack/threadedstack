import { describe, it, expect, vi, beforeEach } from 'vitest'

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

const mockQueryFetch = vi.fn((opts: any) => opts.queryFn())

vi.mock(`@TAF/services/query`, () => ({
  query: {
    fetch: (opts: any) => mockQueryFetch(opts),
    options: vi.fn((o: any) => o),
  },
}))

vi.unmock(`@TAF/services/api`)

import { Asset } from '@tdsk/domain'
import { assetsApi } from './assetsApi'

describe(`AssetsApi`, () => {
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
    assetsApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(assetsApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`list()`, () => {
    it(`should GET /assets, use cache.list() as the default queryKey, and map each item to an Asset`, async () => {
      const rows = [
        { id: `a1`, name: `one` },
        { id: `a2`, name: `two` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await assetsApi.list()

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/assets`)
      expect(init.method).toBe(`GET`)

      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(assetsApi.cache.list())

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Asset)
      expect(resp.data![0].id).toBe(`a1`)
    })

    it(`should let an explicit data.queryKey override the default`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      const customKey = [`custom`, `key`] as const
      await assetsApi.list({ queryKey: customKey })

      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(customKey)
    })

    it(`should fall back to an empty array when resp.data is not an array`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, {}))

      const resp = await assetsApi.list()

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with 'Failed to load Assets list' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await assetsApi.list()

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Assets list`
      )
    })
  })

  describe(`getByThread()`, () => {
    it(`should include threadId in the query data and use cache.byThread(threadId) as the queryKey`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [{ id: `a1` }] }))

      const resp = await assetsApi.getByThread(`thread-1`, { limit: 5 })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain(`threadId=thread-1`)
      expect(url).toContain(`limit=5`)

      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(assetsApi.cache.byThread(`thread-1`))

      expect(resp.data![0]).toBeInstanceOf(Asset)
    })

    it(`should call _onError with 'Failed to load Assets for thread' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await assetsApi.getByThread(`thread-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Assets for thread`
      )
    })
  })

  describe(`getByMessage()`, () => {
    it(`should include messageId in the query data and use cache.byMessage(messageId) as the queryKey`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [{ id: `a1` }] }))

      const resp = await assetsApi.getByMessage(`msg-1`, { limit: 5 })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain(`messageId=msg-1`)
      expect(url).toContain(`limit=5`)

      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(assetsApi.cache.byMessage(`msg-1`))

      expect(resp.data![0]).toBeInstanceOf(Asset)
    })

    it(`should call _onError with 'Failed to load Assets for message' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await assetsApi.getByMessage(`msg-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Assets for message`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET /assets/:id and wrap the response as an Asset`, async () => {
      const row = { id: `a1`, name: `one` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const resp = await assetsApi.get(`a1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/assets/a1`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toBeInstanceOf(Asset)
      expect(resp.data!.id).toBe(`a1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      const resp = await assetsApi.get(`missing`)

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to load Asset' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await assetsApi.get(`missing`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to load Asset`)
    })
  })

  describe(`create()`, () => {
    it(`should POST to /assets with the body and wrap the response as an Asset`, async () => {
      const row = { id: `a1`, name: `New` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { name: `New` }
      const resp = await assetsApi.create(payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/assets`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(Asset)
      expect(resp.data!.id).toBe(`a1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      const resp = await assetsApi.create({ name: `New` })

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to create Asset' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await assetsApi.create({ name: `New` })

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to create Asset`)
    })
  })

  describe(`update()`, () => {
    it(`should PUT to /assets/:id with the body and wrap the response as an Asset`, async () => {
      const row = { id: `a1`, name: `Updated` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { name: `Updated` }
      const resp = await assetsApi.update(`a1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/assets/a1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(Asset)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      const resp = await assetsApi.update(`a1`, { name: `x` })

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to update Asset' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await assetsApi.update(`a1`, { name: `x` })

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to update Asset`)
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE /assets/:id and return the raw response unchanged`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await assetsApi.delete(`a1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/assets/a1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
      expect(resp.data).not.toBeInstanceOf(Asset)
    })

    it(`should call _onError with 'Failed to delete Asset' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await assetsApi.delete(`a1`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to delete Asset`)
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() returns ['/assets']`, () => {
      expect(assetsApi.cache.all()).toEqual([`/assets`])
    })

    it(`cache.list() extends cache.all() with ['list']`, () => {
      expect(assetsApi.cache.list()).toEqual([`/assets`, `list`])
    })

    it(`cache.detail(id) extends cache.all() with ['detail', id]`, () => {
      expect(assetsApi.cache.detail(`a1`)).toEqual([`/assets`, `detail`, `a1`])
    })

    it(`cache.byThread(threadId) extends cache.all() with ['thread', threadId]`, () => {
      expect(assetsApi.cache.byThread(`thread-1`)).toEqual([
        `/assets`,
        `thread`,
        `thread-1`,
      ])
    })

    it(`cache.byMessage(messageId) extends cache.all() with ['message', messageId]`, () => {
      expect(assetsApi.cache.byMessage(`msg-1`)).toEqual([`/assets`, `message`, `msg-1`])
    })
  })
})

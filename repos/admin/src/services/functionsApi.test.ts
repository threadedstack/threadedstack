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

import { Function as FunctionModel } from '@tdsk/domain'
import { functionsApi } from './functionsApi'

describe(`FunctionsApi`, () => {
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
    functionsApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET the project-scoped path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await functionsApi.list(`org-1`, `proj-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/functions`)
      expect(init.method).toBe(`GET`)
    })

    it(`should map each row into a Function instance`, async () => {
      const rows = [
        { id: `f-1`, name: `one`, projectId: `proj-1` },
        { id: `f-2`, name: `two`, projectId: `proj-1` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await functionsApi.list(`org-1`, `proj-1`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(FunctionModel)
      expect(resp.data![0].id).toBe(`f-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await functionsApi.list(`org-1`, `proj-1`)

      expect(resp.data).toEqual([])
    })

    it(`should not throw and should fall back to an empty array when the response body has no top-level 'data' key (parseResponse returns the raw non-array body as resp.data)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { notData: true }))

      const resp = await functionsApi.list(`org-1`, `proj-1`)

      expect(resp.data).toEqual([])
    })

    it(`should use data.queryKey to override the default cache.list() key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await functionsApi.list(`org-1`, `proj-1`, { queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should default the cache.list() key scope to org/project`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await functionsApi.list(`org-1`, `proj-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: functionsApi.cache.list(`org-1`, `proj-1`) })
      )
    })

    it(`should call _onError with 'Failed to load Functions list' on error`, async () => {
      const onErrorSpy = vi.spyOn(functionsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await functionsApi.list(`org-1`, `proj-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Functions list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET the function by id and map to a Function instance`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `f-1` } }))

      const resp = await functionsApi.get(`org-1`, `proj-1`, `f-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/functions/f-1`)
      expect(resp.data).toBeInstanceOf(FunctionModel)
    })

    it(`should call _onError with 'Failed to load Function' on error`, async () => {
      const onErrorSpy = vi.spyOn(functionsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await functionsApi.get(`org-1`, `proj-1`, `f-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Function`
      )
    })
  })

  describe(`create()`, () => {
    it(`should POST new function data and map the response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `f-1` } }))

      const resp = await functionsApi.create(`org-1`, `proj-1`, { name: `new` })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/functions`)
      expect(init.method).toBe(`POST`)
      expect(resp.data).toBeInstanceOf(FunctionModel)
    })
  })

  describe(`update()`, () => {
    it(`should PUT updated function data and map the response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `f-1` } }))

      const resp = await functionsApi.update(`org-1`, `proj-1`, `f-1`, {
        name: `updated`,
      })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/functions/f-1`)
      expect(init.method).toBe(`PUT`)
      expect(resp.data).toBeInstanceOf(FunctionModel)
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE the function by id`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      await functionsApi.delete(`org-1`, `proj-1`, `f-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/functions/f-1`)
      expect(init.method).toBe(`DELETE`)
    })

    it(`should call _onError with 'Failed to delete Function' on error`, async () => {
      const onErrorSpy = vi.spyOn(functionsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await functionsApi.delete(`org-1`, `proj-1`, `f-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to delete Function`
      )
    })
  })

  describe(`invoke()`, () => {
    it(`should POST the function id's /invoke path with the given input`, async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse(200, { data: { result: { ok: true }, logs: ``, durationMs: 5 } })
      )

      const resp = await functionsApi.invoke(`org-1`, `proj-1`, `f-1`, { x: 1 })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/functions/f-1/invoke`
      )
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual({ input: { x: 1 } })
      expect(resp.data).toEqual({ result: { ok: true }, logs: ``, durationMs: 5 })
    })

    it(`should default input to {} when omitted`, async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse(200, { data: { result: null, logs: ``, durationMs: 1 } })
      )

      await functionsApi.invoke(`org-1`, `proj-1`, `f-1`)

      const [, init] = mockFetch.mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({ input: {} })
    })

    it(`should call _onError with 'Failed to invoke Function' on error`, async () => {
      const onErrorSpy = vi.spyOn(functionsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await functionsApi.invoke(`org-1`, `proj-1`, `f-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to invoke Function`
      )
    })
  })
})

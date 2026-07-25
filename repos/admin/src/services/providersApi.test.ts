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

import { Provider } from '@tdsk/domain'
import { providersApi } from './providersApi'

describe(`ProvidersApi`, () => {
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
    providersApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(providersApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`list()`, () => {
    it(`should GET the org-scoped providers path`, async () => {
      const rows = [
        { id: `p1`, brand: `openai` },
        { id: `p2`, brand: `anthropic` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await providersApi.list(`org-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/providers`)
      expect(init.method).toBe(`GET`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Provider)
      expect(resp.data![0].id).toBe(`p1`)
    })

    it(`should let an explicit data.queryKey override the default cache.list key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await providersApi.list(`org-1`, { queryKey: [`custom`, `key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom`, `key`] })
      )
    })

    it(`should default to cache.list(orgId) as the queryKey when none is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await providersApi.list(`org-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: providersApi.cache.list(`org-1`) })
      )
    })

    it(`should send the remaining data fields (minus queryKey) as GET query params`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await providersApi.list(`org-1`, { queryKey: [`x`], limit: 10 })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/providers?limit=10`)
    })

    it(`should not throw and fall back to an empty array when resp.data is null`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await providersApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should fall back to an empty array when the response body has no data field`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, {}))

      const resp = await providersApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with the list failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await providersApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Providers list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET /providers/:id and wrap the response as a Provider`, async () => {
      const row = { id: `p1`, brand: `openai` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const resp = await providersApi.get(`org-1`, `p1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/providers/p1`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toBeInstanceOf(Provider)
      expect(resp.data!.id).toBe(`p1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      const resp = await providersApi.get(`org-1`, `missing`)

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with the get failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await providersApi.get(`org-1`, `missing`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Provider`
      )
    })
  })

  describe(`create()`, () => {
    it(`should POST to the org-scoped base path with the body and wrap the response`, async () => {
      const row = { id: `p1`, brand: `openai` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { brand: `openai` } as const
      const resp = await providersApi.create(`org-1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/providers`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(Provider)
      expect(resp.data!.id).toBe(`p1`)
    })

    it(`should call _onError with the create failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await providersApi.create(`org-1`, { brand: `openai` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to create Provider`
      )
    })
  })

  describe(`update()`, () => {
    it(`should PUT to /providers/:id with the body and wrap the response`, async () => {
      const row = { id: `p1`, brand: `anthropic` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { brand: `anthropic` } as const
      const resp = await providersApi.update(`org-1`, `p1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/providers/p1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(Provider)
    })

    it(`should call _onError with the update failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await providersApi.update(`org-1`, `p1`, { brand: `openai` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to update Provider`
      )
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE /providers/:id and return the raw success response unwrapped`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await providersApi.delete(`org-1`, `p1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/providers/p1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
      expect(resp.data).not.toBeInstanceOf(Provider)
    })

    it(`should call _onError with the delete failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await providersApi.delete(`org-1`, `p1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to delete Provider`
      )
    })
  })

  describe(`fetchModels()`, () => {
    it(`should POST to /providers/:brand/models with an explicit baseUrl`, async () => {
      const models = [{ id: `gpt-4o`, name: `GPT-4o` }]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: models }))

      const resp = await providersApi.fetchModels(`org-1`, `openai`, {
        baseUrl: `https://custom.local`,
      })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/providers/openai/models`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual({ baseUrl: `https://custom.local` })
      expect(resp.data).toEqual(models)
      expect(resp.data![0]).not.toBeInstanceOf(Provider)
    })

    it(`should send baseUrl as undefined when opts is omitted`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await providersApi.fetchModels(`org-1`, `openai`)

      const [, init] = mockFetch.mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({ baseUrl: undefined })
    })

    it(`should fall back to an empty array when resp.data is null`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await providersApi.fetchModels(`org-1`, `openai`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with the fetch-models failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await providersApi.fetchModels(`org-1`, `openai`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to fetch Provider models`
      )
    })
  })
})

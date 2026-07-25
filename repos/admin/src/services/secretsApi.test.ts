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

import { Secret } from '@tdsk/domain'
import { secretsApi } from './secretsApi'

describe(`SecretsApi`, () => {
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
    secretsApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(secretsApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`list()`, () => {
    it(`should GET the org-scoped path when projectId is omitted`, async () => {
      const rows = [
        { id: `s1`, name: `A` },
        { id: `s2`, name: `B` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await secretsApi.list(`org-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/secrets`)
      expect(init.method).toBe(`GET`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Secret)
      expect(resp.data![0].id).toBe(`s1`)
    })

    it(`should GET the project-scoped path when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await secretsApi.list(`org-1`, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/secrets`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, {}))

      const resp = await secretsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with the list failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await secretsApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Secrets list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET /secrets/:id on the org-scoped path and wrap the response as a Secret`, async () => {
      const row = { id: `s1`, name: `A` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const resp = await secretsApi.get(`org-1`, `s1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/secrets/s1`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toBeInstanceOf(Secret)
      expect(resp.data!.id).toBe(`s1`)
    })

    it(`should GET /secrets/:id on the project-scoped path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `s1` } }))

      await secretsApi.get(`org-1`, `s1`, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/secrets/s1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      const resp = await secretsApi.get(`org-1`, `missing`)

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with the get failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await secretsApi.get(`org-1`, `missing`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to load Secret`)
    })
  })

  describe(`create()`, () => {
    it(`should POST to the org-scoped base path with the body and wrap the response`, async () => {
      const row = { id: `s1`, name: `New` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { name: `New`, value: `v` }
      const resp = await secretsApi.create(`org-1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/secrets`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(Secret)
      expect(resp.data!.id).toBe(`s1`)
    })

    it(`should POST to the project-scoped base path when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `s1` } }))

      await secretsApi.create(`org-1`, { name: `New` }, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/secrets`)
    })

    it(`should call _onError with the create failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await secretsApi.create(`org-1`, { name: `New` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to create Secret`
      )
    })
  })

  describe(`update()`, () => {
    it(`should PUT to /secrets/:id on the org-scoped path with the body and wrap the response`, async () => {
      const row = { id: `s1`, name: `Updated` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { name: `Updated` }
      const resp = await secretsApi.update(`org-1`, `s1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/secrets/s1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(Secret)
    })

    it(`should PUT to /secrets/:id on the project-scoped path when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `s1` } }))

      await secretsApi.update(`org-1`, `s1`, { name: `Updated` }, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/secrets/s1`)
    })

    it(`should call _onError with the update failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await secretsApi.update(`org-1`, `s1`, { name: `x` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to update Secret`
      )
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE /secrets/:id on the org-scoped path and return the raw success response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await secretsApi.delete(`org-1`, `s1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/secrets/s1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
      expect(resp.data).not.toBeInstanceOf(Secret)
    })

    it(`should DELETE /secrets/:id on the project-scoped path when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      await secretsApi.delete(`org-1`, `s1`, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/secrets/s1`)
    })

    it(`should call _onError with the delete failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await secretsApi.delete(`org-1`, `s1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to delete Secret`
      )
    })
  })
})

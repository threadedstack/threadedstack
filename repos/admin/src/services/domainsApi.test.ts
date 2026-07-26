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

import { Domain } from '@tdsk/domain'
import { domainsApi } from './domainsApi'

describe(`DomainsApi`, () => {
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
    domainsApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(domainsApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`list()`, () => {
    it(`should GET the org-scoped path and use cache.list(orgId, 'org') as queryKey when projectId is omitted`, async () => {
      const rows = [
        { id: `d1`, domain: `one.example.com` },
        { id: `d2`, domain: `two.example.com` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await domainsApi.list(`org1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org1/domains`)
      expect(init.method).toBe(`GET`)

      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(domainsApi.cache.list(`org1`, `org`))

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Domain)
      expect(resp.data![0].id).toBe(`d1`)
    })

    it(`should GET the project-scoped path and use cache.list(orgId, projectId) as queryKey when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await domainsApi.list(`org1`, `proj1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org1/projects/proj1/domains`)

      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(domainsApi.cache.list(`org1`, `proj1`))
    })

    it(`should let an explicit data.queryKey override the default`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      const customKey = [`custom`, `key`] as const
      await domainsApi.list(`org1`, undefined, { queryKey: customKey })

      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual(customKey)
    })

    it(`should fall back to an empty array when resp.data is not an array`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, {}))

      const resp = await domainsApi.list(`org1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with 'Failed to load Domains list' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await domainsApi.list(`org1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Domains list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET the org-scoped path and wrap the response as a Domain`, async () => {
      const row = { id: `d1`, domain: `one.example.com` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const resp = await domainsApi.get(`org1`, `d1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org1/domains/d1`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toBeInstanceOf(Domain)
      expect(resp.data!.id).toBe(`d1`)
    })

    it(`should GET the project-scoped path when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `d1` } }))

      await domainsApi.get(`org1`, `d1`, `proj1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org1/projects/proj1/domains/d1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      const resp = await domainsApi.get(`org1`, `missing`)

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to load Domain' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await domainsApi.get(`org1`, `missing`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to load Domain`)
    })
  })

  describe(`create()`, () => {
    it(`should POST the org-scoped path with the body and wrap the response as a Domain`, async () => {
      const row = { id: `d1`, domain: `new.example.com` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { domain: `new.example.com` }
      const resp = await domainsApi.create(`org1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org1/domains`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(Domain)
      expect(resp.data!.id).toBe(`d1`)
    })

    it(`should POST the project-scoped path when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `d1` } }))

      await domainsApi.create(`org1`, { domain: `new.example.com` }, `proj1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org1/projects/proj1/domains`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      const resp = await domainsApi.create(`org1`, { domain: `x` })

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to create Domain' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await domainsApi.create(`org1`, { domain: `x` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to create Domain`
      )
    })
  })

  describe(`update()`, () => {
    it(`should PUT the org-scoped path with the body and wrap the response as a Domain`, async () => {
      const row = { id: `d1`, domain: `updated.example.com` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { domain: `updated.example.com` }
      const resp = await domainsApi.update(`org1`, `d1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org1/domains/d1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(Domain)
    })

    it(`should PUT the project-scoped path when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `d1` } }))

      await domainsApi.update(`org1`, `d1`, { domain: `x` }, `proj1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org1/projects/proj1/domains/d1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      const resp = await domainsApi.update(`org1`, `d1`, { domain: `x` })

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to update Domain' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await domainsApi.update(`org1`, `d1`, { domain: `x` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to update Domain`
      )
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE the org-scoped path and return the raw response unchanged`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await domainsApi.delete(`org1`, `d1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org1/domains/d1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
      expect(resp.data).not.toBeInstanceOf(Domain)
    })

    it(`should DELETE the project-scoped path when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      await domainsApi.delete(`org1`, `d1`, `proj1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org1/projects/proj1/domains/d1`)
    })

    it(`should call _onError with 'Failed to delete Domain' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await domainsApi.delete(`org1`, `d1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to delete Domain`
      )
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() returns ['domains']`, () => {
      expect(domainsApi.cache.all()).toEqual([`domains`])
    })

    it(`cache.list(...scope) extends cache.all() with ['list', ...scope]`, () => {
      expect(domainsApi.cache.list(`org1`, `org`)).toEqual([
        `domains`,
        `list`,
        `org1`,
        `org`,
      ])
    })

    it(`cache.detail(id) extends cache.all() with ['detail', id]`, () => {
      expect(domainsApi.cache.detail(`d1`)).toEqual([`domains`, `detail`, `d1`])
    })
  })
})

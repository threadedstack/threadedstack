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

import { Sandbox } from '@tdsk/domain'
import { sandboxApi } from './sandboxApi'

describe(`SandboxApi`, () => {
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
    sandboxApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET the org-scoped path when projectId is omitted`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await sandboxApi.list(`org-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/sandboxes`)
      expect(init.method).toBe(`GET`)
    })

    it(`should GET the project-scoped path when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await sandboxApi.list(`org-1`, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/sandboxes`)
    })

    it(`should map each row into a Sandbox instance`, async () => {
      const rows = [
        { id: `sb-1`, name: `one`, orgId: `org-1` },
        { id: `sb-2`, name: `two`, orgId: `org-1` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await sandboxApi.list(`org-1`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Sandbox)
      expect(resp.data![0].id).toBe(`sb-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await sandboxApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should use data.queryKey to override the default cache.list() key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await sandboxApi.list(`org-1`, undefined, { queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should default the cache.list() key scope to 'org' when projectId is omitted`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await sandboxApi.list(`org-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: sandboxApi.cache.list(`org-1`, `org`) })
      )
    })

    it(`should call _onError with 'Failed to load Sandbox configs list' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await sandboxApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Sandbox configs list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET the org-scoped path/:id when projectId is omitted`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `sb-1` } }))

      await sandboxApi.get(`org-1`, `sb-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/sandboxes/sb-1`)
      expect(init.method).toBe(`GET`)
    })

    it(`should GET the project-scoped path/:id when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `sb-1` } }))

      await sandboxApi.get(`org-1`, `sb-1`, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1`)
    })

    it(`should wrap the response as a single Sandbox`, async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse(200, { data: { id: `sb-1`, name: `one` } })
      )

      const resp = await sandboxApi.get(`org-1`, `sb-1`)

      expect(resp.data).toBeInstanceOf(Sandbox)
      expect(resp.data!.id).toBe(`sb-1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      const resp = await sandboxApi.get(`org-1`, `missing`)

      expect(resp.error).toBeDefined()
      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to load Sandbox config' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await sandboxApi.get(`org-1`, `missing`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Sandbox config`
      )
    })
  })

  describe(`create()`, () => {
    it(`should POST to the org-scoped path when projectId is omitted`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `sb-1` } }))

      const payload = { name: `one` }
      await sandboxApi.create(`org-1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/sandboxes`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
    })

    it(`should POST to the project-scoped path when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `sb-1` } }))

      await sandboxApi.create(`org-1`, { name: `one` }, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/sandboxes`)
    })

    it(`should wrap the response as a Sandbox`, async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse(200, { data: { id: `sb-1`, name: `one` } })
      )

      const resp = await sandboxApi.create(`org-1`, { name: `one` })

      expect(resp.data).toBeInstanceOf(Sandbox)
      expect(resp.data!.id).toBe(`sb-1`)
    })

    it(`should call _onError with 'Failed to create Sandbox config' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await sandboxApi.create(`org-1`, { name: `one` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to create Sandbox config`
      )
    })
  })

  describe(`update()`, () => {
    it(`should PUT to the org-scoped path/:id when projectId is omitted`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `sb-1` } }))

      const payload = { name: `updated` }
      await sandboxApi.update(`org-1`, `sb-1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/sandboxes/sb-1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)
    })

    it(`should PUT to the project-scoped path/:id when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `sb-1` } }))

      await sandboxApi.update(`org-1`, `sb-1`, { name: `updated` }, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1`)
    })

    it(`should wrap the response as a Sandbox`, async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse(200, { data: { id: `sb-1`, name: `updated` } })
      )

      const resp = await sandboxApi.update(`org-1`, `sb-1`, { name: `updated` })

      expect(resp.data).toBeInstanceOf(Sandbox)
      expect(resp.data!.name).toBe(`updated`)
    })

    it(`should call _onError with 'Failed to update Sandbox config' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await sandboxApi.update(`org-1`, `sb-1`, { name: `x` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to update Sandbox config`
      )
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE the org-scoped path/:id, never a project-scoped path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await sandboxApi.delete(`org-1`, `sb-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/sandboxes/sb-1`)
      expect(url).not.toContain(`/projects/`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with 'Failed to delete Sandbox config' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await sandboxApi.delete(`org-1`, `sb-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to delete Sandbox config`
      )
    })
  })

  describe(`getConfig()`, () => {
    it(`should GET the project-scoped config path and return the raw response`, async () => {
      const config = { sandboxId: `sb-1`, projectId: `proj-1`, alias: `main` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: config }))

      const resp = await sandboxApi.getConfig(`org-1`, `proj-1`, `sb-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1/config`
      )
      expect(init.method).toBe(`GET`)
      expect(resp.data).toEqual(config)
      expect(resp.data).not.toBeInstanceOf(Sandbox)
    })

    it(`should call _onError with 'Failed to load sandbox config' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `boom` }))

      await sandboxApi.getConfig(`org-1`, `proj-1`, `sb-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load sandbox config`
      )
    })
  })

  describe(`upsertConfig()`, () => {
    it(`should PUT to the project-scoped config path with the given data`, async () => {
      const config = { sandboxId: `sb-1`, projectId: `proj-1`, alias: `main` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: config }))

      const resp = await sandboxApi.upsertConfig(`org-1`, `proj-1`, `sb-1`, config)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1/config`
      )
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(config)
      expect(resp.data).toEqual(config)
    })

    it(`should call _onError with 'Failed to save sandbox config' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await sandboxApi.upsertConfig(`org-1`, `proj-1`, `sb-1`, { alias: `main` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to save sandbox config`
      )
    })
  })

  describe(`deleteConfig()`, () => {
    it(`should DELETE the project-scoped config path and return the raw response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: {} }))

      const resp = await sandboxApi.deleteConfig(`org-1`, `proj-1`, `sb-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/sandboxes/sb-1/config`
      )
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({})
    })

    it(`should call _onError with 'Failed to reset sandbox config' on error`, async () => {
      const onErrorSpy = vi.spyOn(sandboxApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await sandboxApi.deleteConfig(`org-1`, `proj-1`, `sb-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to reset sandbox config`
      )
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() should be ['sandboxes']`, () => {
      expect(sandboxApi.cache.all()).toEqual([`sandboxes`])
    })

    it(`cache.list(...scope) should extend all() with 'list' and the given scope`, () => {
      expect(sandboxApi.cache.list(`org-1`, `proj-1`)).toEqual([
        `sandboxes`,
        `list`,
        `org-1`,
        `proj-1`,
      ])
    })

    it(`cache.detail(id) should extend all() with 'detail', id`, () => {
      expect(sandboxApi.cache.detail(`sb-1`)).toEqual([`sandboxes`, `detail`, `sb-1`])
    })
  })
})

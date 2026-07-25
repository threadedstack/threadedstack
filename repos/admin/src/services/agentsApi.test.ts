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

import { Agent } from '@tdsk/domain'
import { agentsApi } from './agentsApi'

describe(`AgentsApi`, () => {
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
    agentsApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET the org-scoped path when projectId is omitted`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await agentsApi.list(`org-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/agents`)
      expect(init.method).toBe(`GET`)
    })

    it(`should GET the project-scoped path when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await agentsApi.list(`org-1`, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/agents`)
    })

    it(`should map each row into an Agent instance`, async () => {
      const rows = [
        { id: `a-1`, name: `one`, orgId: `org-1` },
        { id: `a-2`, name: `two`, orgId: `org-1` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await agentsApi.list(`org-1`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Agent)
      expect(resp.data![0].id).toBe(`a-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await agentsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should use data.queryKey to override the default cache.list() key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await agentsApi.list(`org-1`, undefined, { queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should default the cache.list() key scope to 'org' when projectId is omitted`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await agentsApi.list(`org-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: agentsApi.cache.list(`org-1`, `org`) })
      )
    })

    it(`should use the project id as the cache.list() key scope when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await agentsApi.list(`org-1`, `proj-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: agentsApi.cache.list(`org-1`, `proj-1`) })
      )
    })

    it(`should call _onError with 'Failed to load Agents list' on error`, async () => {
      const onErrorSpy = vi.spyOn(agentsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await agentsApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Agents list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET the org-scoped path/:id when projectId is omitted`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `a-1` } }))

      await agentsApi.get(`org-1`, `a-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/agents/a-1`)
      expect(init.method).toBe(`GET`)
    })

    it(`should GET the project-scoped path/:id when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `a-1` } }))

      await agentsApi.get(`org-1`, `a-1`, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/agents/a-1`)
    })

    it(`should wrap the response as a single Agent`, async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse(200, { data: { id: `a-1`, name: `one` } })
      )

      const resp = await agentsApi.get(`org-1`, `a-1`)

      expect(resp.data).toBeInstanceOf(Agent)
      expect(resp.data!.id).toBe(`a-1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      const resp = await agentsApi.get(`org-1`, `missing`)

      expect(resp.error).toBeDefined()
      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to load Agent' on error`, async () => {
      const onErrorSpy = vi.spyOn(agentsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await agentsApi.get(`org-1`, `missing`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to load Agent`)
    })
  })

  describe(`create()`, () => {
    it(`should POST to the org-scoped path when projectId is omitted`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `a-1` } }))

      const payload = { name: `one` } as any
      await agentsApi.create(`org-1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/agents`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
    })

    it(`should POST to the project-scoped path when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `a-1` } }))

      await agentsApi.create(`org-1`, { name: `one` } as any, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/agents`)
    })

    it(`should wrap the response as an Agent`, async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse(200, { data: { id: `a-1`, name: `one` } })
      )

      const resp = await agentsApi.create(`org-1`, { name: `one` } as any)

      expect(resp.data).toBeInstanceOf(Agent)
      expect(resp.data!.id).toBe(`a-1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await agentsApi.create(`org-1`, { name: `one` } as any)

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to create Agent' on error`, async () => {
      const onErrorSpy = vi.spyOn(agentsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await agentsApi.create(`org-1`, { name: `one` } as any)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to create Agent`)
    })
  })

  describe(`update()`, () => {
    it(`should PUT to the org-scoped path/:id when projectId is omitted`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `a-1` } }))

      const payload = { name: `updated` } as any
      await agentsApi.update(`org-1`, `a-1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/agents/a-1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)
    })

    it(`should PUT to the project-scoped path/:id when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `a-1` } }))

      await agentsApi.update(`org-1`, `a-1`, { name: `updated` } as any, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/agents/a-1`)
    })

    it(`should wrap the response as an Agent`, async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse(200, { data: { id: `a-1`, name: `updated` } })
      )

      const resp = await agentsApi.update(`org-1`, `a-1`, { name: `updated` } as any)

      expect(resp.data).toBeInstanceOf(Agent)
      expect(resp.data!.name).toBe(`updated`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await agentsApi.update(`org-1`, `a-1`, { name: `x` } as any)

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to update Agent' on error`, async () => {
      const onErrorSpy = vi.spyOn(agentsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await agentsApi.update(`org-1`, `a-1`, { name: `x` } as any)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to update Agent`)
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE the org-scoped path/:id when projectId is omitted`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await agentsApi.delete(`org-1`, `a-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/agents/a-1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should DELETE the project-scoped path/:id when projectId is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      await agentsApi.delete(`org-1`, `a-1`, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/agents/a-1`)
    })

    it(`should return the raw response, not wrapped in an Agent`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await agentsApi.delete(`org-1`, `a-1`)

      expect(resp.data).toEqual({ success: true })
      expect(resp.data).not.toBeInstanceOf(Agent)
    })

    it(`should call _onError with 'Failed to delete Agent' on error`, async () => {
      const onErrorSpy = vi.spyOn(agentsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await agentsApi.delete(`org-1`, `a-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to delete Agent`)
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() should be ['agents']`, () => {
      expect(agentsApi.cache.all()).toEqual([`agents`])
    })

    it(`cache.list(...scope) should extend all() with 'list' and the given scope`, () => {
      expect(agentsApi.cache.list(`org-1`, `proj-1`)).toEqual([
        `agents`,
        `list`,
        `org-1`,
        `proj-1`,
      ])
    })

    it(`cache.detail(id) should extend all() with 'detail', id`, () => {
      expect(agentsApi.cache.detail(`a-1`)).toEqual([`agents`, `detail`, `a-1`])
    })
  })
})

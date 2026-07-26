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

import { agentActivityApi } from './agentActivityApi'

describe(`AgentActivityApi`, () => {
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
    agentActivityApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(agentActivityApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`status()`, () => {
    it(`should GET the /activity/status path, use [...cache.detail(agentId), 'status'] as queryKey, and staleTime 0`, async () => {
      const record = {
        id: `rec-1`,
        data: { status: `running` },
        createdAt: `2026-07-25T00:00:00Z`,
      }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: record }))

      const resp = await agentActivityApi.status(`org-1`, `proj-1`, `agent-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/agents/agent-1/activity/status`
      )
      expect(init.method).toBe(`GET`)

      expect(mockQueryFetch).toHaveBeenCalledOnce()
      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual([
        ...agentActivityApi.cache.detail(`agent-1`),
        `status`,
      ])
      expect(queryOpts.staleTime).toBe(0)

      expect(resp.data).toEqual(record.data)
    })

    it(`should return undefined when the agent has never run (null envelope)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await agentActivityApi.status(`org-1`, `proj-1`, `agent-1`)

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to load agent status' when resp.error is present`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await agentActivityApi.status(`org-1`, `proj-1`, `agent-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load agent status`
      )
    })
  })

  describe(`turns()`, () => {
    it(`should GET the /activity/turns path with the default limit=25, use [...cache.list(...), 'turns'] as queryKey, and staleTime 0`, async () => {
      const rows = [{ id: `t1`, data: {}, createdAt: `2026-07-25T00:00:00Z` }]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await agentActivityApi.turns(`org-1`, `proj-1`, `agent-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/agents/agent-1/activity/turns?limit=25`
      )
      expect(init.method).toBe(`GET`)

      expect(mockQueryFetch).toHaveBeenCalledOnce()
      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual([
        ...agentActivityApi.cache.list(`org-1`, `proj-1`, `agent-1`),
        `turns`,
      ])
      expect(queryOpts.staleTime).toBe(0)

      expect(resp.data).toEqual(rows)
    })

    it(`should send a custom limit when provided, overriding the default 25`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await agentActivityApi.turns(`org-1`, `proj-1`, `agent-1`, 5)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/agents/agent-1/activity/turns?limit=5`
      )
    })

    it(`should fall back to an empty array when resp.data is null`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await agentActivityApi.turns(`org-1`, `proj-1`, `agent-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with 'Failed to load agent turns' when resp.error is present`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await agentActivityApi.turns(`org-1`, `proj-1`, `agent-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load agent turns`
      )
    })
  })

  describe(`messages()`, () => {
    it(`should GET the /activity/messages path with the default limit=25, use [...cache.list(...), 'messages'] as queryKey, and staleTime 0`, async () => {
      const rows = [{ id: `m1`, data: {}, createdAt: `2026-07-25T00:00:00Z` }]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await agentActivityApi.messages(`org-1`, `proj-1`, `agent-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/agents/agent-1/activity/messages?limit=25`
      )
      expect(init.method).toBe(`GET`)

      expect(mockQueryFetch).toHaveBeenCalledOnce()
      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual([
        ...agentActivityApi.cache.list(`org-1`, `proj-1`, `agent-1`),
        `messages`,
      ])
      expect(queryOpts.staleTime).toBe(0)

      expect(resp.data).toEqual(rows)
    })

    it(`should send a custom limit when provided, overriding the default 25`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await agentActivityApi.messages(`org-1`, `proj-1`, `agent-1`, 5)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/agents/agent-1/activity/messages?limit=5`
      )
    })

    it(`should fall back to an empty array when resp.data is null`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await agentActivityApi.messages(`org-1`, `proj-1`, `agent-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with 'Failed to load agent messages' when resp.error is present`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await agentActivityApi.messages(`org-1`, `proj-1`, `agent-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load agent messages`
      )
    })
  })

  describe(`memories()`, () => {
    it(`should GET the /activity/memories path with the default limit=25, use [...cache.list(...), 'memories'] as queryKey, and staleTime 0`, async () => {
      const rows = [{ id: `mem1`, data: {}, createdAt: `2026-07-25T00:00:00Z` }]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await agentActivityApi.memories(`org-1`, `proj-1`, `agent-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/agents/agent-1/activity/memories?limit=25`
      )
      expect(init.method).toBe(`GET`)

      expect(mockQueryFetch).toHaveBeenCalledOnce()
      const queryOpts = mockQueryFetch.mock.calls[0][0]
      expect(queryOpts.queryKey).toEqual([
        ...agentActivityApi.cache.list(`org-1`, `proj-1`, `agent-1`),
        `memories`,
      ])
      expect(queryOpts.staleTime).toBe(0)

      expect(resp.data).toEqual(rows)
    })

    it(`should send a custom limit when provided, overriding the default 25`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await agentActivityApi.memories(`org-1`, `proj-1`, `agent-1`, 5)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/agents/agent-1/activity/memories?limit=5`
      )
    })

    it(`should fall back to an empty array when resp.data is null`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await agentActivityApi.memories(`org-1`, `proj-1`, `agent-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with 'Failed to load agent memories' when resp.error is present`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await agentActivityApi.memories(`org-1`, `proj-1`, `agent-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load agent memories`
      )
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() returns ['agentActivity']`, () => {
      expect(agentActivityApi.cache.all()).toEqual([`agentActivity`])
    })

    it(`cache.detail(id) extends cache.all() with ['detail', id]`, () => {
      expect(agentActivityApi.cache.detail(`agent-1`)).toEqual([
        `agentActivity`,
        `detail`,
        `agent-1`,
      ])
    })

    it(`cache.list(...scope) extends cache.all() with ['list', ...scope]`, () => {
      expect(agentActivityApi.cache.list(`org-1`, `proj-1`, `agent-1`)).toEqual([
        `agentActivity`,
        `list`,
        `org-1`,
        `proj-1`,
        `agent-1`,
      ])
    })
  })
})

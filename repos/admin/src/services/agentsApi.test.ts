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

  describe(`getConfig()`, () => {
    it(`should GET the project-scoped config path and return the raw response`, async () => {
      const config = { agentId: `a-1`, projectId: `proj-1`, alias: `main` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: config }))

      const resp = await agentsApi.getConfig(`org-1`, `proj-1`, `a-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/agents/a-1/config`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toEqual(config)
      expect(resp.data).not.toBeInstanceOf(Agent)
    })

    it(`should call _onError with 'Failed to load agent config' on error`, async () => {
      const onErrorSpy = vi.spyOn(agentsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `boom` }))

      await agentsApi.getConfig(`org-1`, `proj-1`, `a-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load agent config`
      )
    })
  })

  describe(`upsertConfig()`, () => {
    it(`should PUT to the project-scoped config path with the given data`, async () => {
      const config = { agentId: `a-1`, projectId: `proj-1`, alias: `main` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: config }))

      const resp = await agentsApi.upsertConfig(`org-1`, `proj-1`, `a-1`, config)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/agents/a-1/config`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(config)
      expect(resp.data).toEqual(config)
    })

    it(`should call _onError with 'Failed to save agent config' on error`, async () => {
      const onErrorSpy = vi.spyOn(agentsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await agentsApi.upsertConfig(`org-1`, `proj-1`, `a-1`, { alias: `main` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to save agent config`
      )
    })
  })

  describe(`deleteConfig()`, () => {
    it(`should DELETE the project-scoped config path and return the raw response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: {} }))

      const resp = await agentsApi.deleteConfig(`org-1`, `proj-1`, `a-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/agents/a-1/config`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({})
    })

    it(`should call _onError with 'Failed to reset agent config' on error`, async () => {
      const onErrorSpy = vi.spyOn(agentsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await agentsApi.deleteConfig(`org-1`, `proj-1`, `a-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to reset agent config`
      )
    })
  })

  describe(`createSession()`, () => {
    it(`should POST to the top-level /ai/sessions path with { agentId }`, async () => {
      const session = { model: `gpt-4`, provider: `openai`, sessionToken: `tok-1` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: session }))

      const resp = await agentsApi.createSession(`org-1`, `a-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/ai/sessions`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual({ agentId: `a-1` })
      expect(resp.data).toEqual(session)
    })

    it(`should call _onError with 'Failed to create session' on error`, async () => {
      const onErrorSpy = vi.spyOn(agentsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await agentsApi.createSession(`org-1`, `a-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to create session`
      )
    })
  })

  describe(`run()`, () => {
    let mockStream: ReturnType<typeof vi.fn>

    beforeEach(() => {
      mockStream = vi.fn()
      agentsApi.api.stream = mockStream as any
    })

    it(`should call this.api.stream with the run path and { prompt, threadId }`, async () => {
      const streamResult = { ok: true, status: 200, response: new Response() }
      mockStream.mockResolvedValueOnce(streamResult)

      const resp = await agentsApi.run(`org-1`, `a-1`, `hello`, `thread-1`)

      expect(mockStream).toHaveBeenCalledWith({
        path: `/orgs/org-1/agents/a-1/run`,
        data: { prompt: `hello`, threadId: `thread-1` },
      })
      expect(resp).toBe(streamResult)
    })

    it(`should omit threadId (undefined) when not passed`, async () => {
      const streamResult = { ok: true, status: 200, response: new Response() }
      mockStream.mockResolvedValueOnce(streamResult)

      await agentsApi.run(`org-1`, `a-1`, `hello`)

      expect(mockStream).toHaveBeenCalledWith({
        path: `/orgs/org-1/agents/a-1/run`,
        data: { prompt: `hello`, threadId: undefined },
      })
    })

    it(`should return the raw TApiResponseObj from stream() unwrapped`, async () => {
      const streamResult = { ok: false, status: 500, error: { message: `boom` } }
      mockStream.mockResolvedValueOnce(streamResult)

      const resp = await agentsApi.run(`org-1`, `a-1`, `hello`)

      expect(resp).toEqual(streamResult)
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

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

import { Message } from '@tdsk/domain'
import { messagesApi } from './messagesApi'

describe(`MessagesApi`, () => {
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
    messagesApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(messagesApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`listByThread()`, () => {
    it(`should GET the thread-scoped path, use cache.byThread(threadId) by default, and map each item to a Message`, async () => {
      const rows = [
        { id: `m1`, content: `hi` },
        { id: `m2`, content: `there` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await messagesApi.listByThread(`org-1`, `agent-1`, `thread-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/agents/agent-1/threads/thread-1/messages`
      )
      expect(init.method).toBe(`GET`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Message)
      expect(resp.data![0].id).toBe(`m1`)
    })

    it(`should use a caller-supplied queryKey when provided instead of cache.byThread`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      // queryKey isn't observable via the mocked fetch call directly (it's
      // consumed by this.api.get's internal query.fetch wiring), so this
      // asserts the destructured `queryKey` is excluded from the forwarded
      // request data rather than sent as a query param.
      await messagesApi.listByThread(`org-1`, `agent-1`, `thread-1`, {
        queryKey: [`custom`],
        limit: 5,
      })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain(`limit=5`)
      expect(url).not.toContain(`queryKey`)
    })

    it(`should resolve to an empty array when resp.data is not an array`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, {}))

      const resp = await messagesApi.listByThread(`org-1`, `agent-1`, `thread-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with 'Failed to load Messages' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await messagesApi.listByThread(`org-1`, `agent-1`, `thread-1`)

      expect(onErrorSpy).toHaveBeenCalledOnce()
      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Messages`
      )
    })
  })

  describe(`update()`, () => {
    it(`should PUT to the message path with the body and wrap a truthy response in a Message`, async () => {
      const row = { id: `m1`, content: `edited` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { content: `edited` }
      const resp = await messagesApi.update(`org-1`, `agent-1`, `thread-1`, `m1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/agents/agent-1/threads/thread-1/messages/m1`
      )
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(Message)
      expect(resp.data!.id).toBe(`m1`)
    })

    it(`should resolve data: undefined when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      const resp = await messagesApi.update(`org-1`, `agent-1`, `thread-1`, `m1`, {
        content: `x`,
      })

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to update Message' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await messagesApi.update(`org-1`, `agent-1`, `thread-1`, `m1`, { content: `x` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to update Message`
      )
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE the message path and return the raw response unchanged`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await messagesApi.delete(`org-1`, `agent-1`, `thread-1`, `m1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/agents/agent-1/threads/thread-1/messages/m1`
      )
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
      expect(resp.data).not.toBeInstanceOf(Message)
    })

    it(`should call _onError with 'Failed to delete Message' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await messagesApi.delete(`org-1`, `agent-1`, `thread-1`, `m1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to delete Message`
      )
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() returns ['messages']`, () => {
      expect(messagesApi.cache.all()).toEqual([`messages`])
    })

    it(`cache.list() extends cache.all() with ['list']`, () => {
      expect(messagesApi.cache.list()).toEqual([`messages`, `list`])
    })

    it(`cache.detail(id) extends cache.all() with ['detail', id]`, () => {
      expect(messagesApi.cache.detail(`m1`)).toEqual([`messages`, `detail`, `m1`])
    })

    it(`cache.byThread(threadId) extends cache.all() with ['thread', threadId]`, () => {
      expect(messagesApi.cache.byThread(`thread-1`)).toEqual([
        `messages`,
        `thread`,
        `thread-1`,
      ])
    })
  })
})

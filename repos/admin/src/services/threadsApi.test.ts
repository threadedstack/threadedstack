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

import { Thread } from '@tdsk/domain'
import { threadsApi } from './threadsApi'

describe(`ThreadsApi`, () => {
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
    threadsApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(threadsApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`list()`, () => {
    it(`should GET the org/agent threads path and wrap each row as a Thread`, async () => {
      const rows = [{ id: `t1` }, { id: `t2` }]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await threadsApi.list(`org-1`, `agent-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/agents/agent-1/threads`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Thread)
    })

    it(`should fall back to an empty array when resp.data is null`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await threadsApi.list(`org-1`, `agent-1`)

      expect(resp.data).toEqual([])
    })

    it(`should fall back to an empty array without throwing when the response body has no data field (resp.data is a non-array object, not falsy)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, {}))

      const resp = await threadsApi.list(`org-1`, `agent-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with the list failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await threadsApi.list(`org-1`, `agent-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Threads list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET /threads/:id and wrap the response as a Thread`, async () => {
      const row = { id: `t1` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const resp = await threadsApi.get(`org-1`, `agent-1`, `t1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/agents/agent-1/threads/t1`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toBeInstanceOf(Thread)
    })

    it(`should call _onError with the get failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await threadsApi.get(`org-1`, `agent-1`, `missing`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to load Thread`)
    })
  })

  describe(`create()`, () => {
    it(`should POST to the threads path with the body and wrap the response`, async () => {
      const row = { id: `t1` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { name: `New Thread` }
      const resp = await threadsApi.create(`org-1`, `agent-1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/agents/agent-1/threads`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(Thread)
    })

    it(`should call _onError with the create failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await threadsApi.create(`org-1`, `agent-1`, { name: `x` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to create Thread`
      )
    })
  })

  describe(`update()`, () => {
    it(`should PUT to /threads/:id with the body and wrap the response`, async () => {
      const row = { id: `t1`, name: `Updated` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { name: `Updated` }
      const resp = await threadsApi.update(`org-1`, `agent-1`, `t1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/agents/agent-1/threads/t1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(Thread)
    })

    it(`should call _onError with the update failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await threadsApi.update(`org-1`, `agent-1`, `t1`, { name: `x` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to update Thread`
      )
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE /threads/:id`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await threadsApi.delete(`org-1`, `agent-1`, `t1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/agents/agent-1/threads/t1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with the delete failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await threadsApi.delete(`org-1`, `agent-1`, `t1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to delete Thread`
      )
    })
  })

  describe(`listMessages()`, () => {
    it(`should GET /threads/:threadId/messages and return the raw response`, async () => {
      const rows = [{ id: `m1` }]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await threadsApi.listMessages(`org-1`, `agent-1`, `t1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/agents/agent-1/threads/t1/messages`
      )
      expect(init.method).toBe(`GET`)
      expect(resp.data).toEqual(rows)
    })

    it(`should call _onError with the messages failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await threadsApi.listMessages(`org-1`, `agent-1`, `t1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load messages`
      )
    })
  })

  describe(`branch()`, () => {
    it(`should POST to /threads/:threadId/branch with a { messageId } body and wrap the response`, async () => {
      const row = { id: `t2`, messages: [] }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const resp = await threadsApi.branch(`org-1`, `agent-1`, `t1`, `m1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/agents/agent-1/threads/t1/branch`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual({ messageId: `m1` })
      expect(resp.data).toBeInstanceOf(Thread)
    })

    it(`should call _onError with the branch failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await threadsApi.branch(`org-1`, `agent-1`, `t1`, `m1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to branch Thread`
      )
    })
  })
})

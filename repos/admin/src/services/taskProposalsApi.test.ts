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

import { TaskProposal } from '@tdsk/domain'
import { taskProposalsApi } from './taskProposalsApi'

describe(`TaskProposalsApi`, () => {
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
    taskProposalsApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET the org-scoped path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await taskProposalsApi.list(`org-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/task-proposals`)
      expect(init.method).toBe(`GET`)
    })

    it(`should map each row into a TaskProposal instance`, async () => {
      const rows = [
        { id: `t-1`, orgId: `org-1` },
        { id: `t-2`, orgId: `org-1` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await taskProposalsApi.list(`org-1`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(TaskProposal)
      expect(resp.data![0].id).toBe(`t-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await taskProposalsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should not throw and should fall back to an empty array when the response body has no top-level 'data' key (parseResponse returns the raw non-array body as resp.data)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { notData: true }))

      const resp = await taskProposalsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should use data.queryKey to override the default cache.list() key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await taskProposalsApi.list(`org-1`, { queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should default the cache.list() key scope to org`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await taskProposalsApi.list(`org-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: taskProposalsApi.cache.list(`org-1`) })
      )
    })

    it(`should call _onError with 'Failed to load Task Proposals list' on error`, async () => {
      const onErrorSpy = vi.spyOn(taskProposalsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await taskProposalsApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Task Proposals list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET the task proposal by id and map to a TaskProposal instance`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `t-1` } }))

      const resp = await taskProposalsApi.get(`org-1`, `t-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/task-proposals/t-1`)
      expect(resp.data).toBeInstanceOf(TaskProposal)
    })

    it(`should call _onError with 'Failed to load Task Proposal' on error`, async () => {
      const onErrorSpy = vi.spyOn(taskProposalsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await taskProposalsApi.get(`org-1`, `t-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Task Proposal`
      )
    })
  })

  describe(`review()`, () => {
    it(`should POST a review decision and map the response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `t-1` } }))

      const resp = await taskProposalsApi.review(`org-1`, `t-1`, { approve: false })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/task-proposals/t-1/review`)
      expect(init.method).toBe(`POST`)
      expect(resp.data).toBeInstanceOf(TaskProposal)
    })

    it(`should call _onError with 'Failed to review Task Proposal' on error`, async () => {
      const onErrorSpy = vi.spyOn(taskProposalsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await taskProposalsApi.review(`org-1`, `t-1`, { approve: false, reason: `no` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to review Task Proposal`
      )
    })
  })
})

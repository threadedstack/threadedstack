import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockQueryFetch = vi.fn((opts: any) => opts.queryFn())

vi.mock(`@TTH/services/tokenRefresh`, () => ({
  tokenRefresh: {
    refreshAndRetry: vi.fn(),
  },
}))

vi.mock(`@TTH/services/auth`, () => ({
  authClient: {
    getSession: vi.fn().mockResolvedValue({
      data: { session: { token: `test` }, user: { id: `u1` } },
    }),
  },
}))

vi.mock(`@TTH/utils/api/apiUrl`, () => ({
  apiUrl: () => `http://test.local`,
}))

vi.mock(`@TTH/services/query`, () => ({
  query: {
    fetch: (opts: any) => mockQueryFetch(opts),
    options: vi.fn((o: any) => o),
  },
}))

vi.unmock(`@TTH/services/api`)

import { Schedule } from '@tdsk/domain'
import { scheduleApi } from './scheduleApi'

describe(`ScheduleApi`, () => {
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
    scheduleApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET the project-scoped path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await scheduleApi.list(`org-1`, `proj-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/schedules`)
      expect(init.method).toBe(`GET`)
    })

    it(`should map each row into a Schedule instance`, async () => {
      const rows = [
        { id: `s-1`, projectId: `proj-1` },
        { id: `s-2`, projectId: `proj-1` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await scheduleApi.list(`org-1`, `proj-1`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Schedule)
      expect(resp.data![0].id).toBe(`s-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await scheduleApi.list(`org-1`, `proj-1`)

      expect(resp.data).toEqual([])
    })

    it(`should use data.queryKey to override the default cache.list() key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await scheduleApi.list(`org-1`, `proj-1`, { queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should default the cache.list() key scope to org/project`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await scheduleApi.list(`org-1`, `proj-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: scheduleApi.cache.list(`org-1`, `proj-1`) })
      )
    })

    it(`should call _onError with 'Failed to load Schedules list' on error`, async () => {
      const onErrorSpy = vi.spyOn(scheduleApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await scheduleApi.list(`org-1`, `proj-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Schedules list`
      )
    })
  })
})

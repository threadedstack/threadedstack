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

import { Schedule, ScheduleRun } from '@tdsk/domain'
import { schedulesApi } from './schedulesApi'

describe(`SchedulesApi`, () => {
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
    schedulesApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET the project-scoped path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await schedulesApi.list(`org-1`, `proj-1`)

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

      const resp = await schedulesApi.list(`org-1`, `proj-1`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Schedule)
      expect(resp.data![0].id).toBe(`s-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await schedulesApi.list(`org-1`, `proj-1`)

      expect(resp.data).toEqual([])
    })

    it(`should not throw and should fall back to an empty array when the response body has no top-level 'data' key (parseResponse returns the raw non-array body as resp.data)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { notData: true }))

      const resp = await schedulesApi.list(`org-1`, `proj-1`)

      expect(resp.data).toEqual([])
    })

    it(`should use data.queryKey to override the default cache.list() key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await schedulesApi.list(`org-1`, `proj-1`, { queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should default the cache.list() key scope to org/project`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await schedulesApi.list(`org-1`, `proj-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: schedulesApi.cache.list(`org-1`, `proj-1`) })
      )
    })

    it(`should call _onError with 'Failed to load Schedules list' on error`, async () => {
      const onErrorSpy = vi.spyOn(schedulesApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await schedulesApi.list(`org-1`, `proj-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Schedules list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET the schedule by id and map to a Schedule instance`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `s-1` } }))

      const resp = await schedulesApi.get(`org-1`, `proj-1`, `s-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/schedules/s-1`)
      expect(resp.data).toBeInstanceOf(Schedule)
    })

    it(`should call _onError with 'Failed to load Schedule' on error`, async () => {
      const onErrorSpy = vi.spyOn(schedulesApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await schedulesApi.get(`org-1`, `proj-1`, `s-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Schedule`
      )
    })
  })

  describe(`create()`, () => {
    it(`should POST new schedule data and map the response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `s-1` } }))

      const resp = await schedulesApi.create(`org-1`, `proj-1`, { prompt: `new` })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/schedules`)
      expect(init.method).toBe(`POST`)
      expect(resp.data).toBeInstanceOf(Schedule)
    })

    it(`should call _onError with 'Failed to create Schedule' on error`, async () => {
      const onErrorSpy = vi.spyOn(schedulesApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await schedulesApi.create(`org-1`, `proj-1`, { prompt: `new` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to create Schedule`
      )
    })
  })

  describe(`update()`, () => {
    it(`should PUT updated schedule data and map the response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `s-1` } }))

      const resp = await schedulesApi.update(`org-1`, `proj-1`, `s-1`, {
        prompt: `updated`,
      })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/schedules/s-1`)
      expect(init.method).toBe(`PUT`)
      expect(resp.data).toBeInstanceOf(Schedule)
    })

    it(`should call _onError with 'Failed to update Schedule' on error`, async () => {
      const onErrorSpy = vi.spyOn(schedulesApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await schedulesApi.update(`org-1`, `proj-1`, `s-1`, { prompt: `updated` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to update Schedule`
      )
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE the schedule by id`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      await schedulesApi.delete(`org-1`, `proj-1`, `s-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/schedules/s-1`)
      expect(init.method).toBe(`DELETE`)
    })

    it(`should call _onError with 'Failed to delete Schedule' on error`, async () => {
      const onErrorSpy = vi.spyOn(schedulesApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await schedulesApi.delete(`org-1`, `proj-1`, `s-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to delete Schedule`
      )
    })
  })

  describe(`trigger()`, () => {
    it(`should POST to the trigger path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      await schedulesApi.trigger(`org-1`, `proj-1`, `s-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/schedules/s-1/trigger`
      )
      expect(init.method).toBe(`POST`)
    })

    it(`should call _onError with 'Failed to trigger Schedule' on error`, async () => {
      const onErrorSpy = vi.spyOn(schedulesApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await schedulesApi.trigger(`org-1`, `proj-1`, `s-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to trigger Schedule`
      )
    })
  })

  describe(`listRuns()`, () => {
    it(`should GET the runs path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await schedulesApi.listRuns(`org-1`, `proj-1`, `s-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/schedules/s-1/runs`
      )
      expect(init.method).toBe(`GET`)
    })

    it(`should map each row into a ScheduleRun instance`, async () => {
      const rows = [{ id: `r-1` }, { id: `r-2` }]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await schedulesApi.listRuns(`org-1`, `proj-1`, `s-1`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(ScheduleRun)
      expect(resp.data![0].id).toBe(`r-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await schedulesApi.listRuns(`org-1`, `proj-1`, `s-1`)

      expect(resp.data).toEqual([])
    })

    it(`should not throw and should fall back to an empty array when the response body has no top-level 'data' key (parseResponse returns the raw non-array body as resp.data)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { notData: true }))

      const resp = await schedulesApi.listRuns(`org-1`, `proj-1`, `s-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with 'Failed to load Schedule runs' on error`, async () => {
      const onErrorSpy = vi.spyOn(schedulesApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await schedulesApi.listRuns(`org-1`, `proj-1`, `s-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Schedule runs`
      )
    })
  })

  describe(`getRun()`, () => {
    it(`should GET the run by id and map to a ScheduleRun instance`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `r-1` } }))

      const resp = await schedulesApi.getRun(`org-1`, `proj-1`, `s-1`, `r-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/schedules/s-1/runs/r-1`
      )
      expect(resp.data).toBeInstanceOf(ScheduleRun)
    })

    it(`should call _onError with 'Failed to load Schedule run' on error`, async () => {
      const onErrorSpy = vi.spyOn(schedulesApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await schedulesApi.getRun(`org-1`, `proj-1`, `s-1`, `r-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Schedule run`
      )
    })
  })
})

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

import { Project } from '@tdsk/domain'
import { projectsApi } from './projectsApi'

describe(`ProjectsApi`, () => {
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
    projectsApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET the org-scoped projects path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await projectsApi.list(`org-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects`)
      expect(init.method).toBe(`GET`)
    })

    it(`should map each row into a Project instance`, async () => {
      const rows = [
        { id: `proj-1`, orgId: `org-1` },
        { id: `proj-2`, orgId: `org-1` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await projectsApi.list(`org-1`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Project)
      expect(resp.data![0].id).toBe(`proj-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await projectsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should use data.queryKey to override the default cache.list() key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await projectsApi.list(`org-1`, { queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should default the cache.list() key scope to orgId`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await projectsApi.list(`org-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: projectsApi.cache.list(`org-1`) })
      )
    })

    it(`should call _onError with 'Failed to load projects' on error`, async () => {
      const onErrorSpy = vi.spyOn(projectsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await projectsApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load projects`
      )
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() returns ['projects']`, () => {
      expect(projectsApi.cache.all()).toEqual([`projects`])
    })

    it(`cache.list(orgId) extends cache.all() with ['list', orgId]`, () => {
      expect(projectsApi.cache.list(`org-1`)).toEqual([`projects`, `list`, `org-1`])
    })

    it(`cache.detail(id) extends cache.all() with ['detail', id]`, () => {
      expect(projectsApi.cache.detail(`proj-1`)).toEqual([`projects`, `detail`, `proj-1`])
    })
  })
})

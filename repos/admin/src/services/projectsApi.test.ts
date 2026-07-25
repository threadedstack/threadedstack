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
    it(`should GET /orgs/:orgId/projects and reduce the response into a Record keyed by project id`, async () => {
      const projects = [
        { id: `proj-1`, name: `First`, orgId: `org-1` },
        { id: `proj-2`, name: `Second`, orgId: `org-1` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: projects }))

      const resp = await projectsApi.list(`org-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects`)
      expect(init.method).toBe(`GET`)

      expect(resp.data).toEqual({
        [`proj-1`]: expect.any(Project),
        [`proj-2`]: expect.any(Project),
      })
      expect(resp.data![`proj-1`].name).toBe(`First`)
      expect(resp.data![`proj-2`].name).toBe(`Second`)
    })

    it(`should use data.queryKey to override the default cache.list(orgId) key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await projectsApi.list(`org-1`, { queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should default to cache.list(orgId) when no queryKey override is given`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await projectsApi.list(`org-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: projectsApi.cache.list(`org-1`) })
      )
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await projectsApi.list(`org-1`)

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to load Projects list' on error`, async () => {
      const onErrorSpy = vi.spyOn(projectsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await projectsApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Projects list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET /orgs/:orgId/projects/:id and wrap the response as a single Project`, async () => {
      const project = { id: `proj-1`, name: `First`, orgId: `org-1` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: project }))

      const resp = await projectsApi.get(`org-1`, `proj-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1`)
      expect(init.method).toBe(`GET`)

      expect(resp.data).toBeInstanceOf(Project)
      expect(resp.data!.id).toBe(`proj-1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      const resp = await projectsApi.get(`org-1`, `missing`)

      expect(resp.error).toBeDefined()
      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to load Project' on error`, async () => {
      const onErrorSpy = vi.spyOn(projectsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await projectsApi.get(`org-1`, `missing`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to load Project`)
    })
  })

  describe(`create()`, () => {
    it(`should POST to /orgs/:orgId/projects with the given data and wrap the response`, async () => {
      const project = { id: `proj-1`, name: `First`, orgId: `org-1` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: project }))

      const payload = { name: `First`, orgId: `org-1` }
      const resp = await projectsApi.create(`org-1`, payload)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)

      expect(resp.data).toBeInstanceOf(Project)
      expect(resp.data!.id).toBe(`proj-1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await projectsApi.create(`org-1`, { name: `First` })

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to create Project' on error`, async () => {
      const onErrorSpy = vi.spyOn(projectsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await projectsApi.create(`org-1`, { name: `First` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to create Project`
      )
    })
  })

  describe(`update()`, () => {
    it(`should PUT to /orgs/:orgId/projects/:id with the given data and wrap the response`, async () => {
      const project = { id: `proj-1`, name: `First Updated`, orgId: `org-1` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: project }))

      const payload = { name: `First Updated` }
      const resp = await projectsApi.update(`org-1`, `proj-1`, payload)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)

      expect(resp.data).toBeInstanceOf(Project)
      expect(resp.data!.name).toBe(`First Updated`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await projectsApi.update(`org-1`, `proj-1`, { name: `x` })

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to update Project' on error`, async () => {
      const onErrorSpy = vi.spyOn(projectsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await projectsApi.update(`org-1`, `proj-1`, { name: `x` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to update Project`
      )
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE /orgs/:orgId/projects/:id and return the success response unwrapped`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await projectsApi.delete(`org-1`, `proj-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with 'Failed to delete Project' on error`, async () => {
      const onErrorSpy = vi.spyOn(projectsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await projectsApi.delete(`org-1`, `proj-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to delete Project`
      )
    })
  })

  describe(`listByOrg()`, () => {
    it(`should delegate to list(orgId, { queryKey: cache.list(orgId) })`, async () => {
      const listSpy = vi.spyOn(projectsApi, `list`)
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await projectsApi.listByOrg(`org-1`)

      expect(listSpy).toHaveBeenCalledWith(`org-1`, {
        queryKey: projectsApi.cache.list(`org-1`),
      })
    })

    it(`should GET /orgs/:orgId/projects and reduce into a Record keyed by project id`, async () => {
      const projects = [{ id: `proj-1`, name: `First`, orgId: `org-1` }]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: projects }))

      const resp = await projectsApi.listByOrg(`org-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects`)
      expect(init.method).toBe(`GET`)
      expect(resp.data![`proj-1`]).toBeInstanceOf(Project)
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() should be ['/projects']`, () => {
      expect(projectsApi.cache.all()).toEqual([`/projects`])
    })

    it(`cache.list(orgId) should extend all() with 'list', orgId`, () => {
      expect(projectsApi.cache.list(`org-1`)).toEqual([`/projects`, `list`, `org-1`])
    })

    it(`cache.detail(id) should extend all() with 'detail', id`, () => {
      expect(projectsApi.cache.detail(`proj-1`)).toEqual([
        `/projects`,
        `detail`,
        `proj-1`,
      ])
    })
  })
})

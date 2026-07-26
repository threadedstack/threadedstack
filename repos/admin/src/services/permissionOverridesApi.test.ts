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

import { permissionOverridesApi } from './permissionOverridesApi'

describe(`PermissionOverridesApi`, () => {
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
    permissionOverridesApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(permissionOverridesApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`list()`, () => {
    it(`should GET the org-scoped overrides path and queryKey when no projectId is given`, async () => {
      const rows = [{ id: `ov-1`, userId: `u1`, permission: `read`, effect: `grant` }]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await permissionOverridesApi.list(`org-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/overrides`)
      expect(init.method).toBe(`GET`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: permissionOverridesApi.cache.list(`org-1`) })
      )

      expect(resp.data).toEqual(rows)
    })

    it(`should GET the project-scoped overrides path and queryKey when projectId is given`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await permissionOverridesApi.list(`org-1`, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/overrides`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({
          queryKey: permissionOverridesApi.cache.list(`org-1`, `proj-1`),
        })
      )
      expect(permissionOverridesApi.cache.list(`org-1`, `proj-1`)).toEqual([
        `overrides`,
        `list`,
        `proj-1`,
      ])
    })

    it(`should fall back to an empty array when resp.data is null`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await permissionOverridesApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with 'Failed to load permission overrides' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await permissionOverridesApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load permission overrides`
      )
    })
  })

  describe(`create()`, () => {
    it(`should POST to the org-scoped path with the body and return the response unwrapped`, async () => {
      const row = { id: `ov-1`, userId: `u1`, permission: `read`, effect: `grant` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { userId: `u1`, permission: `read`, effect: `grant` } as const
      const resp = await permissionOverridesApi.create(`org-1`, payload as any)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/overrides`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toEqual(row)
    })

    it(`should POST to the project-scoped path when projectId is given`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: {} }))

      await permissionOverridesApi.create(
        `org-1`,
        { userId: `u1`, permission: `read`, effect: `grant` } as any,
        `proj-1`
      )

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/overrides`)
    })

    it(`should call _onError with 'Failed to create permission override' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await permissionOverridesApi.create(`org-1`, {
        userId: `u1`,
        permission: `read`,
        effect: `grant`,
      } as any)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to create permission override`
      )
    })
  })

  describe(`update()`, () => {
    it(`should PATCH (not PUT) /overrides/:overrideId with the body and return the response unwrapped`, async () => {
      const row = { id: `ov-1`, effect: `deny` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { effect: `deny` } as const
      const resp = await permissionOverridesApi.update(`org-1`, `ov-1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/overrides/ov-1`)
      expect(init.method).toBe(`PATCH`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toEqual(row)
    })

    it(`should PATCH the project-scoped path when projectId is given`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: {} }))

      await permissionOverridesApi.update(`org-1`, `ov-1`, { effect: `grant` }, `proj-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/overrides/ov-1`)
      expect(init.method).toBe(`PATCH`)
    })

    it(`should call _onError with 'Failed to update permission override' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await permissionOverridesApi.update(`org-1`, `ov-1`, { effect: `deny` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to update permission override`
      )
    })
  })

  describe(`remove()`, () => {
    it(`should DELETE /overrides/:overrideId and return the raw success response unwrapped`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await permissionOverridesApi.remove(`org-1`, `ov-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/overrides/ov-1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should DELETE the project-scoped path when projectId is given`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      await permissionOverridesApi.remove(`org-1`, `ov-1`, `proj-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/overrides/ov-1`)
    })

    it(`should call _onError with 'Failed to delete permission override' on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await permissionOverridesApi.remove(`org-1`, `ov-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to delete permission override`
      )
    })
  })
})

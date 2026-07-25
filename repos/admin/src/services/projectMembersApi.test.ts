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

import { Role } from '@tdsk/domain'
import { projectMembersApi } from './projectMembersApi'

describe(`ProjectMembersApi`, () => {
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
    projectMembersApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(projectMembersApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`list()`, () => {
    it(`should GET the org/project members path and wrap each row as a Role`, async () => {
      const rows = [
        { id: `r1`, roleType: `admin` },
        { id: `r2`, roleType: `member` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await projectMembersApi.list(`org-1`, `proj-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/members`)
      expect(init.method).toBe(`GET`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(Role)
      expect(resp.data![0].id).toBe(`r1`)
    })

    it(`should fall back to an empty array when resp.data is null`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await projectMembersApi.list(`org-1`, `proj-1`)

      expect(resp.data).toEqual([])
    })

    it(`should fall back to an empty array without throwing when the response body has no data field (resp.data is a non-array object, not falsy)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, {}))

      const resp = await projectMembersApi.list(`org-1`, `proj-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with the list failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await projectMembersApi.list(`org-1`, `proj-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load project members`
      )
    })
  })

  describe(`add()`, () => {
    it(`should POST to the members path with the body`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const payload = { email: `a@x.com`, roleType: `member` }
      const resp = await projectMembersApi.add(`org-1`, `proj-1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/members`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with the add failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await projectMembersApi.add(`org-1`, `proj-1`, { roleType: `member` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to add project member`
      )
    })
  })

  describe(`updateRole()`, () => {
    it(`should PUT to /members/:userId with a { roleType } body`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await projectMembersApi.updateRole(`org-1`, `proj-1`, `u1`, `admin`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/members/u1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual({ roleType: `admin` })
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with the update-role failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await projectMembersApi.updateRole(`org-1`, `proj-1`, `u1`, `admin`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to update member role`
      )
    })
  })

  describe(`remove()`, () => {
    it(`should DELETE /members/:userId`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await projectMembersApi.remove(`org-1`, `proj-1`, `u1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/projects/proj-1/members/u1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with the remove failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await projectMembersApi.remove(`org-1`, `proj-1`, `u1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to remove project member`
      )
    })
  })
})

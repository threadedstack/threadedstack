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

import { User } from '@tdsk/domain'
import { usersApi } from './usersApi'

describe(`UsersApi`, () => {
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
    usersApi.api.mock = mockFetch as any
    onErrorSpy = vi.spyOn(usersApi, `_onError`).mockResolvedValue(undefined)
  })

  describe(`list()`, () => {
    it(`should GET the users path`, async () => {
      const rows = [
        { id: `u1`, email: `a@x.com` },
        { id: `u2`, email: `b@x.com` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await usersApi.list()

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/users`)
      expect(init.method).toBe(`GET`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(User)
      expect(resp.data![0].id).toBe(`u1`)
    })

    it(`should let an explicit data.queryKey override the default cache.list key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await usersApi.list({ queryKey: [`custom`, `key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom`, `key`] })
      )
    })

    it(`should default to cache.list() as the queryKey when none is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await usersApi.list()

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: usersApi.cache.list() })
      )
    })

    it(`should fall back to an empty array when resp.data is null`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: null }))

      const resp = await usersApi.list()

      expect(resp.data).toEqual([])
    })

    it(`should fall back to an empty array without throwing when the response body has no data field (resp.data is a non-array object, not falsy)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, {}))

      const resp = await usersApi.list()

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with the list failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await usersApi.list()

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Users list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET /users/:id and wrap the response as a User`, async () => {
      const row = { id: `u1`, email: `a@x.com` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const resp = await usersApi.get(`u1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/users/u1`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toBeInstanceOf(User)
      expect(resp.data!.id).toBe(`u1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      const resp = await usersApi.get(`missing`)

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with the get failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await usersApi.get(`missing`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to load User`)
    })
  })

  describe(`create()`, () => {
    it(`should POST to the users path with the body and wrap the response`, async () => {
      const row = { id: `u1`, email: `a@x.com` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { email: `a@x.com` } as const
      const resp = await usersApi.create(payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/users`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(User)
      expect(resp.data!.id).toBe(`u1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      const resp = await usersApi.create({ email: `a@x.com` })

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with the create failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await usersApi.create({ email: `a@x.com` })

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to create User`)
    })
  })

  describe(`update()`, () => {
    it(`should PUT to /users/:id with the body and wrap the response`, async () => {
      const row = { id: `u1`, email: `updated@x.com` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { email: `updated@x.com` } as const
      const resp = await usersApi.update(`u1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/users/u1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toBeInstanceOf(User)
    })

    it(`should call _onError with the update failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await usersApi.update(`u1`, { email: `a@x.com` })

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to update User`)
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE /users/:id and return the raw success response unwrapped`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await usersApi.delete(`u1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/users/u1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
      expect(resp.data).not.toBeInstanceOf(User)
    })

    it(`should call _onError with the delete failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await usersApi.delete(`u1`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to delete User`)
    })
  })

  describe(`me()`, () => {
    it(`should GET /auth/me (not /users) and wrap the response as a User`, async () => {
      const row = { id: `u1`, email: `a@x.com` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const resp = await usersApi.me()

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/auth/me`)
      expect(init.method).toBe(`GET`)
      expect(resp.data).toBeInstanceOf(User)
    })

    it(`should use cache.me() as the queryKey`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `u1` } }))

      await usersApi.me()

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: usersApi.cache.me() })
      )
      expect(usersApi.cache.me()).toEqual([`auth`, `me`])
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(401, { error: `unauthorized` }))

      const resp = await usersApi.me()

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with the me failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(401, { error: `unauthorized` }))

      await usersApi.me()

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to get current user`
      )
    })
  })

  describe(`listByOrg()`, () => {
    it(`should delegate to list() forwarding orgId as a data param and overriding the queryKey`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await usersApi.listByOrg(`org-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/users?orgId=org-1`)
      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: usersApi.cache.listOrg(`org-1`) })
      )
    })
  })

  describe(`inviteToOrg()`, () => {
    it(`should POST to /orgs/:orgId/users/invite with the body`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const payload = { email: `a@x.com`, roleType: `member` }
      const resp = await usersApi.inviteToOrg(`org-1`, payload)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/users/invite`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with the invite failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await usersApi.inviteToOrg(`org-1`, { email: `a@x.com`, roleType: `member` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to invite user to org`
      )
    })
  })

  describe(`updateRole()`, () => {
    it(`should PUT to /orgs/:orgId/members/:userId with a { roleType } body`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await usersApi.updateRole(`org-1`, `u1`, `admin`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/members/u1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual({ roleType: `admin` })
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with the update-role failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad` }))

      await usersApi.updateRole(`org-1`, `u1`, `admin`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to update user role`
      )
    })
  })

  describe(`removeFromOrg()`, () => {
    it(`should DELETE /orgs/:orgId/members/:userId`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await usersApi.removeFromOrg(`org-1`, `u1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/members/u1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with the remove failure message on error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await usersApi.removeFromOrg(`org-1`, `u1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to remove user from org`
      )
    })
  })
})

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

import { Organization } from '@tdsk/domain'
import { orgsApi } from './orgsApi'

describe(`OrgsApi`, () => {
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
    orgsApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET /orgs and reduce the response into a Record keyed by org id`, async () => {
      const orgs = [
        { id: `org-1`, name: `Acme`, ownerId: `u1` },
        { id: `org-2`, name: `Globex`, ownerId: `u2` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: orgs }))

      const resp = await orgsApi.list()

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs`)
      expect(init.method).toBe(`GET`)

      expect(resp.data![`org-1`]).toBeInstanceOf(Organization)
      expect(resp.data![`org-1`].name).toBe(`Acme`)
      expect(resp.data![`org-2`].name).toBe(`Globex`)
    })

    it(`should use data.queryKey to override the default cache.list() key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await orgsApi.list({ queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should fall back to an empty object when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await orgsApi.list()

      expect(resp.data).toEqual({})
    })

    it(`should call _onError with 'Failed to load Orgs list' on error`, async () => {
      const onErrorSpy = vi.spyOn(orgsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await orgsApi.list()

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Orgs list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET /orgs/:id and wrap the response as a single Organization`, async () => {
      const org = { id: `org-1`, name: `Acme`, ownerId: `u1` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: org }))

      const resp = await orgsApi.get(`org-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1`)
      expect(init.method).toBe(`GET`)

      expect(resp.data).toBeInstanceOf(Organization)
      expect(resp.data!.id).toBe(`org-1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      const resp = await orgsApi.get(`missing`)

      expect(resp.error).toBeDefined()
      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to load Org' on error`, async () => {
      const onErrorSpy = vi.spyOn(orgsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await orgsApi.get(`missing`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to load Org`)
    })
  })

  describe(`create()`, () => {
    it(`should POST to /orgs with the given data and wrap the response`, async () => {
      const org = { id: `org-1`, name: `Acme`, ownerId: `u1` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: org }))

      const payload = { name: `Acme`, ownerId: `u1` }
      const resp = await orgsApi.create(payload)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)

      expect(resp.data).toBeInstanceOf(Organization)
      expect(resp.data!.id).toBe(`org-1`)
    })

    it(`should call _onError with 'Failed to create Org' on error`, async () => {
      const onErrorSpy = vi.spyOn(orgsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await orgsApi.create({ name: `Acme`, ownerId: `u1` })

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to create Org`)
    })
  })

  describe(`update()`, () => {
    it(`should PUT to /orgs/:id with the given data and wrap the response`, async () => {
      const org = { id: `org-1`, name: `Acme Updated`, ownerId: `u1` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: org }))

      const payload = { name: `Acme Updated` }
      const resp = await orgsApi.update(`org-1`, payload)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)

      expect(resp.data).toBeInstanceOf(Organization)
      expect(resp.data!.name).toBe(`Acme Updated`)
    })

    it(`should call _onError with 'Failed to update Org' on error`, async () => {
      const onErrorSpy = vi.spyOn(orgsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await orgsApi.update(`org-1`, { name: `x` })

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to update Org`)
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE /orgs/:id and return the success response unwrapped`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await orgsApi.delete(`org-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with 'Failed to delete Org' on error`, async () => {
      const onErrorSpy = vi.spyOn(orgsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await orgsApi.delete(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to delete Org`)
    })
  })

  describe(`addMember()`, () => {
    it(`should POST to /orgs/:orgId/members with the member data`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const memberData = { userId: `u2`, roleType: `member` }
      const resp = await orgsApi.addMember(`org-1`, memberData)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/members`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(memberData)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with 'Failed to add org member' on error`, async () => {
      const onErrorSpy = vi.spyOn(orgsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await orgsApi.addMember(`org-1`, { userId: `u2` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to add org member`
      )
    })
  })

  describe(`removeMember()`, () => {
    it(`should DELETE /orgs/:orgId/members/:userId`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await orgsApi.removeMember(`org-1`, `u2`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/members/u2`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with 'Failed to remove org member' on error`, async () => {
      const onErrorSpy = vi.spyOn(orgsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await orgsApi.removeMember(`org-1`, `u2`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to remove org member`
      )
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() should be ['/orgs']`, () => {
      expect(orgsApi.cache.all()).toEqual([`/orgs`])
    })

    it(`cache.list() should extend all() with 'list'`, () => {
      expect(orgsApi.cache.list()).toEqual([`/orgs`, `list`])
    })

    it(`cache.detail(id) should extend all() with 'detail', id`, () => {
      expect(orgsApi.cache.detail(`org-1`)).toEqual([`/orgs`, `detail`, `org-1`])
    })

    it(`cache.members(orgId) should extend all() with orgId, 'members'`, () => {
      expect(orgsApi.cache.members(`org-1`)).toEqual([`/orgs`, `org-1`, `members`])
    })
  })
})

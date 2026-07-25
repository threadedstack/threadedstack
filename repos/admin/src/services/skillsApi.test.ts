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

import { Skill } from '@tdsk/domain'
import { skillsApi } from './skillsApi'

describe(`SkillsApi`, () => {
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
    skillsApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET /orgs/:orgId/skills and map the response into Skill instances`, async () => {
      const skills = [
        { id: `skill-1`, orgId: `org-1`, name: `Skill One` },
        { id: `skill-2`, orgId: `org-1`, name: `Skill Two` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: skills }))

      const resp = await skillsApi.list(`org-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/skills`)
      expect(init.method).toBe(`GET`)

      expect(resp.data![0]).toBeInstanceOf(Skill)
      expect(resp.data![0].name).toBe(`Skill One`)
      expect(resp.data![1].name).toBe(`Skill Two`)
    })

    it(`should use the default cache.list(orgId) as queryKey when data.queryKey is not passed`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await skillsApi.list(`org-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: skillsApi.cache.list(`org-1`) })
      )
    })

    it(`should let an explicit data.queryKey override the default cache.list() key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await skillsApi.list(`org-1`, { queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should send data minus queryKey as query params on the request URL`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await skillsApi.list(`org-1`, { queryKey: [`custom-key`], limit: 10, offset: 5 })

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/skills?limit=10&offset=5`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await skillsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should call _onError with 'Failed to load Skills list' on error`, async () => {
      const onErrorSpy = vi.spyOn(skillsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await skillsApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Skills list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET /orgs/:orgId/skills/:id and wrap the response as a Skill`, async () => {
      const skill = { id: `skill-1`, orgId: `org-1`, name: `Skill One` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: skill }))

      const resp = await skillsApi.get(`org-1`, `skill-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/skills/skill-1`)
      expect(init.method).toBe(`GET`)

      expect(resp.data).toBeInstanceOf(Skill)
      expect(resp.data!.id).toBe(`skill-1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      const resp = await skillsApi.get(`org-1`, `missing`)

      expect(resp.error).toBeDefined()
      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to load Skill' on error`, async () => {
      const onErrorSpy = vi.spyOn(skillsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `not found` }))

      await skillsApi.get(`org-1`, `missing`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to load Skill`)
    })
  })

  describe(`create()`, () => {
    it(`should POST to /orgs/:orgId/skills with the given data and wrap the response`, async () => {
      const skill = { id: `skill-1`, orgId: `org-1`, name: `Skill One` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: skill }))

      const payload = { name: `Skill One`, orgId: `org-1` }
      const resp = await skillsApi.create(`org-1`, payload)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/skills`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)

      expect(resp.data).toBeInstanceOf(Skill)
      expect(resp.data!.id).toBe(`skill-1`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await skillsApi.create(`org-1`, { name: `Skill One` })

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to create Skill' on error`, async () => {
      const onErrorSpy = vi.spyOn(skillsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await skillsApi.create(`org-1`, { name: `Skill One` })

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to create Skill`)
    })
  })

  describe(`update()`, () => {
    it(`should PUT to /orgs/:orgId/skills/:id with the given data and wrap the response`, async () => {
      const skill = { id: `skill-1`, orgId: `org-1`, name: `Skill One Updated` }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: skill }))

      const payload = { name: `Skill One Updated` }
      const resp = await skillsApi.update(`org-1`, `skill-1`, payload)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/skills/skill-1`)
      expect(init.method).toBe(`PUT`)
      expect(JSON.parse(init.body)).toEqual(payload)

      expect(resp.data).toBeInstanceOf(Skill)
      expect(resp.data!.name).toBe(`Skill One Updated`)
    })

    it(`should return undefined data when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await skillsApi.update(`org-1`, `skill-1`, { name: `x` })

      expect(resp.data).toBeUndefined()
    })

    it(`should call _onError with 'Failed to update Skill' on error`, async () => {
      const onErrorSpy = vi.spyOn(skillsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await skillsApi.update(`org-1`, `skill-1`, { name: `x` })

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to update Skill`)
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE /orgs/:orgId/skills/:id and return the raw success response unwrapped (no Skill model)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await skillsApi.delete(`org-1`, `skill-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/skills/skill-1`)
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
      expect(resp.data).not.toBeInstanceOf(Skill)
    })

    it(`should call _onError with 'Failed to delete Skill' on error`, async () => {
      const onErrorSpy = vi.spyOn(skillsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await skillsApi.delete(`org-1`, `skill-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(expect.anything(), `Failed to delete Skill`)
    })
  })

  describe(`attach()`, () => {
    it(`should POST to /orgs/:orgId/skills/:skillId/attach with {agentId} and return the raw response unwrapped`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await skillsApi.attach(`org-1`, `skill-1`, `agent-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/skills/skill-1/attach`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual({ agentId: `agent-1` })
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with 'Failed to attach Skill to Agent' on error`, async () => {
      const onErrorSpy = vi.spyOn(skillsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await skillsApi.attach(`org-1`, `skill-1`, `agent-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to attach Skill to Agent`
      )
    })
  })

  describe(`detach()`, () => {
    it(`should POST to /orgs/:orgId/skills/:skillId/detach with {agentId} and return the raw response unwrapped`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await skillsApi.detach(`org-1`, `skill-1`, `agent-1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/skills/skill-1/detach`)
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual({ agentId: `agent-1` })
      expect(resp.data).toEqual({ success: true })
    })

    it(`should call _onError with 'Failed to detach Skill from Agent' on error`, async () => {
      const onErrorSpy = vi.spyOn(skillsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      await skillsApi.detach(`org-1`, `skill-1`, `agent-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to detach Skill from Agent`
      )
    })
  })

  describe(`cache key shape`, () => {
    it(`cache.all() should be ['skills']`, () => {
      expect(skillsApi.cache.all()).toEqual([`skills`])
    })

    it(`cache.list(orgId) should extend all() with 'list', orgId`, () => {
      expect(skillsApi.cache.list(`org-1`)).toEqual([`skills`, `list`, `org-1`])
    })

    it(`cache.detail(id) should extend all() with 'detail', id`, () => {
      expect(skillsApi.cache.detail(`skill-1`)).toEqual([`skills`, `detail`, `skill-1`])
    })
  })
})

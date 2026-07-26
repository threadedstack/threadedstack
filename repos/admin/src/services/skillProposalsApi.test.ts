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

import { SkillProposal } from '@tdsk/domain'
import { skillProposalsApi } from './skillProposalsApi'

describe(`SkillProposalsApi`, () => {
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
    skillProposalsApi.api.mock = mockFetch as any
  })

  describe(`list()`, () => {
    it(`should GET the org-scoped path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await skillProposalsApi.list(`org-1`)

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/skill-proposals`)
      expect(init.method).toBe(`GET`)
    })

    it(`should map each row into a SkillProposal instance`, async () => {
      const rows = [
        { id: `p-1`, orgId: `org-1` },
        { id: `p-2`, orgId: `org-1` },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const resp = await skillProposalsApi.list(`org-1`)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(SkillProposal)
      expect(resp.data![0].id).toBe(`p-1`)
    })

    it(`should fall back to an empty array when resp.data is falsy`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      const resp = await skillProposalsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should not throw and should fall back to an empty array when the response body has no top-level 'data' key (parseResponse returns the raw non-array body as resp.data)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { notData: true }))

      const resp = await skillProposalsApi.list(`org-1`)

      expect(resp.data).toEqual([])
    })

    it(`should use data.queryKey to override the default cache.list() key`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await skillProposalsApi.list(`org-1`, { queryKey: [`custom-key`] })

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: [`custom-key`] })
      )
    })

    it(`should default the cache.list() key scope to org`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: [] }))

      await skillProposalsApi.list(`org-1`)

      expect(mockQueryFetch).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: skillProposalsApi.cache.list(`org-1`) })
      )
    })

    it(`should call _onError with 'Failed to load Skill Proposals list' on error`, async () => {
      const onErrorSpy = vi.spyOn(skillProposalsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await skillProposalsApi.list(`org-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Skill Proposals list`
      )
    })
  })

  describe(`get()`, () => {
    it(`should GET the skill proposal by id and map to a SkillProposal instance`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `p-1` } }))

      const resp = await skillProposalsApi.get(`org-1`, `p-1`)

      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/skill-proposals/p-1`)
      expect(resp.data).toBeInstanceOf(SkillProposal)
    })

    it(`should call _onError with 'Failed to load Skill Proposal' on error`, async () => {
      const onErrorSpy = vi.spyOn(skillProposalsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await skillProposalsApi.get(`org-1`, `p-1`)

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to load Skill Proposal`
      )
    })
  })

  describe(`review()`, () => {
    it(`should POST a review decision and map the response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `p-1` } }))

      const resp = await skillProposalsApi.review(`org-1`, `p-1`, { approve: true })

      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(`http://test.local/_/orgs/org-1/skill-proposals/p-1/review`)
      expect(init.method).toBe(`POST`)
      expect(resp.data).toBeInstanceOf(SkillProposal)
    })

    it(`should call _onError with 'Failed to review Skill Proposal' on error`, async () => {
      const onErrorSpy = vi.spyOn(skillProposalsApi, `_onError`)
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `boom` }))

      await skillProposalsApi.review(`org-1`, `p-1`, { approve: false, reason: `no` })

      expect(onErrorSpy).toHaveBeenCalledWith(
        expect.anything(),
        `Failed to review Skill Proposal`
      )
    })
  })
})

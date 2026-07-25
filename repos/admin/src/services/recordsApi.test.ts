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

import { Record as RecordModel } from '@tdsk/domain'
import { recordsApi } from './recordsApi'

describe(`RecordsApi`, () => {
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
    recordsApi.api.mock = mockFetch as any
  })

  describe(`query()`, () => {
    it(`should POST to the /query path with the query body and wrap each row as a Record`, async () => {
      const rows = [
        { id: `r1`, collectionId: `c1`, projectId: `proj-1`, data: { a: 1 } },
        { id: `r2`, collectionId: `c1`, projectId: `proj-1`, data: { a: 2 } },
      ]
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: rows }))

      const query = { where: [{ field: `a`, op: `eq` as const, value: 1 }] }
      const resp = await recordsApi.query(`org-1`, `proj-1`, `col-1`, query as any)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/collections/col-1/records/query`
      )
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(query)

      expect(resp.data).toHaveLength(2)
      expect(resp.data![0]).toBeInstanceOf(RecordModel)
      expect(resp.data![0].id).toBe(`r1`)
      expect(resp.data![1].id).toBe(`r2`)
    })

    it(`should return an empty array when the query errors`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(400, { error: `bad query` }))

      const resp = await recordsApi.query(`org-1`, `proj-1`, `col-1`, {})

      expect(resp.error).toBeDefined()
      expect(resp.data).toEqual([])
    })
  })

  describe(`get()`, () => {
    it(`should GET the record by id and wrap the response as a Record`, async () => {
      const row = { id: `r1`, collectionId: `c1`, projectId: `proj-1`, data: { a: 1 } }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const resp = await recordsApi.get(`org-1`, `proj-1`, `col-1`, `r1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/collections/col-1/records/r1`
      )
      expect(init.method).toBe(`GET`)

      expect(resp.data).toBeInstanceOf(RecordModel)
      expect(resp.data!.id).toBe(`r1`)
      expect(resp.data!.data).toEqual({ a: 1 })
    })

    it(`should return undefined data on a 404`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(404, { error: `Record not found` }))

      const resp = await recordsApi.get(`org-1`, `proj-1`, `col-1`, `missing`)

      expect(resp.error).toBeDefined()
      expect(resp.data).toBeUndefined()
    })
  })

  describe(`upsert()`, () => {
    it(`should POST to the base records path with { id, data } and wrap the response`, async () => {
      const row = { id: `r1`, collectionId: `c1`, projectId: `proj-1`, data: { a: 9 } }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      const payload = { id: `r1`, data: { a: 9 } }
      const resp = await recordsApi.upsert(`org-1`, `proj-1`, `col-1`, payload)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/collections/col-1/records/`
      )
      expect(init.method).toBe(`POST`)
      expect(JSON.parse(init.body)).toEqual(payload)

      expect(resp.data).toBeInstanceOf(RecordModel)
      expect(resp.data!.id).toBe(`r1`)
    })

    it(`should omit id in the body when creating a new record`, async () => {
      const row = {
        id: `new-id`,
        collectionId: `c1`,
        projectId: `proj-1`,
        data: { a: 1 },
      }
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: row }))

      await recordsApi.upsert(`org-1`, `proj-1`, `col-1`, { data: { a: 1 } })

      const [, init] = mockFetch.mock.calls[0]
      expect(JSON.parse(init.body)).toEqual({ data: { a: 1 } })
    })
  })

  describe(`delete()`, () => {
    it(`should DELETE by id and return the success response untouched`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { success: true } }))

      const resp = await recordsApi.delete(`org-1`, `proj-1`, `col-1`, `r1`)

      expect(mockFetch).toHaveBeenCalledOnce()
      const [url, init] = mockFetch.mock.calls[0]
      expect(url).toBe(
        `http://test.local/_/orgs/org-1/projects/proj-1/collections/col-1/records/r1`
      )
      expect(init.method).toBe(`DELETE`)
      expect(resp.data).toEqual({ success: true })
    })

    it(`should surface an error on failure`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(500, { error: `boom` }))

      const resp = await recordsApi.delete(`org-1`, `proj-1`, `col-1`, `r1`)

      expect(resp.error).toBeDefined()
    })
  })
})

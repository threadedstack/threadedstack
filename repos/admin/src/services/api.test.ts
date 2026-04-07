// Import after unmock — vitest hoists vi.unmock so the real module loads
import { ApiService } from './api'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRefreshAndRetry = vi.fn()

vi.mock(`@TAF/services/tokenRefresh`, () => ({
  tokenRefresh: {
    refreshAndRetry: (...args: any[]) => mockRefreshAndRetry(...args),
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
    fetch: vi.fn(),
    options: vi.fn((o: any) => o),
  },
}))

vi.unmock(`@TAF/services/api`)

describe(`ApiService`, () => {
  let service: ApiService
  let mockFetch: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ApiService({ url: `http://test.local` })
    mockFetch = vi.fn()
    service.mock = mockFetch as any
  })

  const makeResponse = (status: number, body: any = {}) =>
    new Response(JSON.stringify(body), {
      status,
      statusText: status === 401 ? `Unauthorized` : `OK`,
      headers: { [`Content-Type`]: `application/json` },
    })

  describe(`invoke() - 401 retry`, () => {
    it(`should return result directly for successful responses`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { id: `1` } }))

      const result = await service.fetch({ path: `test` })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ id: `1` })
      expect(mockRefreshAndRetry).not.toHaveBeenCalled()
    })

    it(`should return result directly for non-401 errors`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(403, { error: `Forbidden` }))

      const result = await service.fetch({ path: `test` })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(403)
      expect(mockRefreshAndRetry).not.toHaveBeenCalled()
    })

    it(`should call tokenRefresh.refreshAndRetry() on 401`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(401, { error: `Unauthorized` }))
      mockRefreshAndRetry.mockResolvedValueOnce(false)

      await service.fetch({ path: `test` })
      expect(mockRefreshAndRetry).toHaveBeenCalledOnce()
    })

    it(`should retry the request once after successful refresh`, async () => {
      mockFetch
        .mockResolvedValueOnce(makeResponse(401, { error: `Unauthorized` }))
        .mockResolvedValueOnce(makeResponse(200, { data: { id: `retried` } }))
      mockRefreshAndRetry.mockResolvedValueOnce(true)

      const result = await service.fetch({ path: `test` })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ id: `retried` })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it(`should return original 401 error when refresh fails`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(401, { error: `Unauthorized` }))
      mockRefreshAndRetry.mockResolvedValueOnce(false)

      const result = await service.fetch({ path: `test` })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(401)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it(`should not retry more than once`, async () => {
      mockFetch
        .mockResolvedValueOnce(makeResponse(401, { error: `Unauthorized` }))
        .mockResolvedValueOnce(makeResponse(401, { error: `Still Unauthorized` }))
      mockRefreshAndRetry.mockResolvedValueOnce(true)

      const result = await service.fetch({ path: `test` })
      // Second 401 is NOT retried — only one retry per fetch call
      expect(result.ok).toBe(false)
      expect(result.status).toBe(401)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockRefreshAndRetry).toHaveBeenCalledOnce()
    })
  })

  describe(`clearBearer()`, () => {
    it(`should remove Authorization header`, () => {
      service.setHeaders({ Authorization: `Bearer test` })

      service.clearBearer()
      expect(service.headers.Authorization).toBeUndefined()
      expect(service.headers.Accept).toBe(`application/json`)
    })

    it(`should be safe to call when no Authorization header exists`, () => {
      service.clearBearer()
      expect(service.headers.Authorization).toBeUndefined()
    })
  })

  describe(`fetch() convenience method`, () => {
    it(`should invoke with the provided method`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { data: { ok: true } }))

      const result = await service.fetch({ path: `test`, method: `POST` })
      expect(result.ok).toBe(true)
      expect(mockFetch).toHaveBeenCalledOnce()
    })
  })

  describe(`bearer()`, () => {
    it(`should set Authorization header from session`, async () => {
      await service.bearer()
      expect(service.headers.Authorization).toBe(`Bearer test`)
    })

    it(`should accept explicit auth data`, async () => {
      const auth = {
        session: {
          id: `s1`,
          token: `explicit-token`,
          userId: `u1`,
          expiresAt: new Date().toISOString(),
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      }
      await service.bearer(auth)
      expect(service.headers.Authorization).toBe(`Bearer explicit-token`)
    })
  })
})

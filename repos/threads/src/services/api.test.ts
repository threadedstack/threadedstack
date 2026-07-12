import { ApiService } from './api'
import { ApiError } from '@TTH/utils/errors/ApiError'
import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockRefreshAndRetry = vi.fn()

vi.mock(`@TTH/services/tokenRefresh`, () => ({
  tokenRefresh: {
    refreshAndRetry: (...args: any[]) => mockRefreshAndRetry(...args),
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
    fetch: vi.fn(),
    options: vi.fn((o: any) => o),
  },
}))

// Shrinks ApiRequestTimeoutMs so the hang/timeout test below completes in
// milliseconds instead of the real 30s -- other constants stay real.
vi.mock(`@TTH/constants/values`, async (importOriginal) => {
  const actual = await importOriginal<typeof import('@TTH/constants/values')>()
  return { ...actual, ApiRequestTimeoutMs: 50 }
})

// Unmock api.ts so we test the real class
vi.mock(`@TTH/services/api`, async () => {
  const actual = await vi.importActual<typeof import('./api')>(`@TTH/services/api`)
  return actual
})

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

  describe(`fetch() - 401 retry`, () => {
    it(`should return result directly for successful responses`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(200, { id: `1` }))

      const result = await service.fetch({ path: `test` })
      expect(result).toEqual({ id: `1` })
      expect(mockRefreshAndRetry).not.toHaveBeenCalled()
    })

    it(`should return result directly for non-401 errors`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(403, { error: `Forbidden` }))

      const result = await service.fetch({ path: `test` })
      expect(result.error).toBeInstanceOf(ApiError)
      expect(result.error.status).toBe(403)
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
        .mockResolvedValueOnce(makeResponse(200, { id: `retried` }))
      mockRefreshAndRetry.mockResolvedValueOnce(true)

      const result = await service.fetch({ path: `test` })
      expect(result).toEqual({ id: `retried` })
      expect(mockFetch).toHaveBeenCalledTimes(2)
    })

    it(`should return original 401 error when refresh fails`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(401, { error: `Unauthorized` }))
      mockRefreshAndRetry.mockResolvedValueOnce(false)

      const result = await service.fetch({ path: `test` })
      expect(result.error).toBeInstanceOf(ApiError)
      expect(result.error.status).toBe(401)
      expect(mockFetch).toHaveBeenCalledTimes(1)
    })

    it(`should not retry more than once`, async () => {
      mockFetch
        .mockResolvedValueOnce(makeResponse(401, { error: `Unauthorized` }))
        .mockResolvedValueOnce(makeResponse(401, { error: `Still Unauthorized` }))
      mockRefreshAndRetry.mockResolvedValueOnce(true)

      const result = await service.fetch({ path: `test` })
      // Second 401 is NOT retried — only one retry per fetch call
      expect(result.error).toBeInstanceOf(ApiError)
      expect(result.error.status).toBe(401)
      expect(mockFetch).toHaveBeenCalledTimes(2)
      expect(mockRefreshAndRetry).toHaveBeenCalledOnce()
    })
  })

  describe(`doFetch() - request timeout`, () => {
    it(`should not hang and resolves to an ApiError when the request times out`, async () => {
      // Mimics real fetch's abort-signal behavior: never resolves on its own,
      // only rejects once the passed AbortSignal actually fires -- this proves
      // #doFetch passes a working, bounded signal rather than an unbounded
      // fetch that would hang forever on a stuck backend/pod.
      mockFetch.mockImplementation((_url: string, opts: RequestInit) => {
        return new Promise((_resolve, reject) => {
          opts.signal?.addEventListener(`abort`, () => {
            reject(new DOMException(`The operation was aborted`, `AbortError`))
          })
        })
      })

      const result = await service.fetch({ path: `test` })

      expect(result.error).toBeInstanceOf(ApiError)
    })

    it(`should not override a caller-supplied signal with its own timeout signal`, async () => {
      const timeoutSpy = vi.spyOn(AbortSignal, `timeout`)
      const controller = new AbortController()
      mockFetch.mockResolvedValueOnce(makeResponse(200, { id: `1` }))

      await service.fetch({ path: `test`, signal: controller.signal })

      expect(timeoutSpy).not.toHaveBeenCalled()
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.signal).toBeInstanceOf(AbortSignal)

      timeoutSpy.mockRestore()
    })
  })

  describe(`clearBearer()`, () => {
    it(`should remove Authorization header`, () => {
      service.options.headers = {
        Accept: `application/json`,
        Authorization: `Bearer test`,
      }

      service.clearBearer()
      expect(service.options.headers).toEqual({ Accept: `application/json` })
    })

    it(`should be safe to call when no Authorization header exists`, () => {
      service.options.headers = { Accept: `application/json` }

      service.clearBearer()
      expect(service.options.headers).toEqual({ Accept: `application/json` })
    })
  })
})

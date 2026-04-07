import { describe, it, expect, vi, afterEach, beforeEach } from 'vitest'
import { EApiMethod } from '@TDM/types'
import { ApiService } from './apiService'
import { Exception } from '@TDM/error/exception'

// ---------------------------------------------------------------------------
// Global fetch mock
// ---------------------------------------------------------------------------

const mockFetch = vi.fn()
vi.stubGlobal(`fetch`, mockFetch)

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const makeResponse = (body: unknown, status = 200, statusText = `OK`): Response => {
  const isError = status >= 400
  return {
    ok: !isError,
    status,
    statusText,
    json: vi.fn().mockResolvedValue(body),
    text: vi
      .fn()
      .mockResolvedValue(typeof body === `string` ? body : JSON.stringify(body)),
  } as unknown as Response
}

const makeService = (
  url = `https://api.example.com`,
  opts: { basePath?: string; headers?: Record<string, string> } = {}
) =>
  new ApiService({
    url,
    basePath: opts.basePath,
    headers: opts.headers,
  })

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe(`ApiService`, () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  // -------------------------------------------------------------------------
  // Constructor
  // -------------------------------------------------------------------------

  describe(`constructor`, () => {
    it(`sets url from config`, () => {
      const svc = makeService(`https://my-api.com`)
      expect(svc.url).toBe(`https://my-api.com`)
    })

    it(`sets basePath from config`, () => {
      const svc = makeService(`https://api.example.com`, { basePath: `v1` })
      expect(svc.basePath).toBe(`v1`)
    })

    it(`defaults basePath to empty string`, () => {
      const svc = makeService()
      expect(svc.basePath).toBe(``)
    })

    it(`sets headers from config`, () => {
      const svc = makeService(`https://api.example.com`, {
        headers: { 'Content-Type': `application/json` },
      })
      expect(svc.headers[`Content-Type`]).toBe(`application/json`)
    })

    it(`defaults headers to empty object`, () => {
      const svc = makeService()
      expect(svc.headers).toEqual({})
    })
  })

  // -------------------------------------------------------------------------
  // setHeaders
  // -------------------------------------------------------------------------

  describe(`setHeaders`, () => {
    it(`merges new headers with existing ones by default`, () => {
      const svc = makeService(`https://api.example.com`, {
        headers: { 'X-Existing': `yes` },
      })
      svc.setHeaders({ Authorization: `Bearer tok` })
      expect(svc.headers[`X-Existing`]).toBe(`yes`)
      expect(svc.headers[`Authorization`]).toBe(`Bearer tok`)
    })

    it(`replaces all headers when merge=false`, () => {
      const svc = makeService(`https://api.example.com`, {
        headers: { 'X-Existing': `yes` },
      })
      svc.setHeaders({ Authorization: `Bearer tok` }, false)
      expect(svc.headers[`X-Existing`]).toBeUndefined()
      expect(svc.headers[`Authorization`]).toBe(`Bearer tok`)
    })

    it(`overwrites an existing header on merge`, () => {
      const svc = makeService(`https://api.example.com`, {
        headers: { Authorization: `Bearer old` },
      })
      svc.setHeaders({ Authorization: `Bearer new` })
      expect(svc.headers[`Authorization`]).toBe(`Bearer new`)
    })
  })

  // -------------------------------------------------------------------------
  // setBearer / clearBearer
  // -------------------------------------------------------------------------

  describe(`setBearer`, () => {
    it(`sets Authorization header with Bearer prefix`, () => {
      const svc = makeService()
      svc.setBearer(`my-token`)
      expect(svc.headers[`Authorization`]).toBe(`Bearer my-token`)
    })

    it(`preserves other headers`, () => {
      const svc = makeService(`https://api.example.com`, {
        headers: { 'X-Custom': `val` },
      })
      svc.setBearer(`tok`)
      expect(svc.headers[`X-Custom`]).toBe(`val`)
    })
  })

  describe(`clearBearer`, () => {
    it(`removes the Authorization header`, () => {
      const svc = makeService()
      svc.setBearer(`tok`)
      svc.clearBearer()
      expect(svc.headers[`Authorization`]).toBeUndefined()
    })

    it(`preserves other headers when clearing bearer`, () => {
      const svc = makeService(`https://api.example.com`, {
        headers: { 'X-Custom': `val` },
      })
      svc.setBearer(`tok`)
      svc.clearBearer()
      expect(svc.headers[`X-Custom`]).toBe(`val`)
    })

    it(`is a no-op when no bearer is set`, () => {
      const svc = makeService()
      expect(() => svc.clearBearer()).not.toThrow()
      expect(svc.headers[`Authorization`]).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // GET requests
  // -------------------------------------------------------------------------

  describe(`get`, () => {
    it(`calls fetch with GET method`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: { id: 1 } }))
      const svc = makeService()
      await svc.get({ path: `/items` })
      expect(mockFetch).toHaveBeenCalledOnce()
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.method).toBe(EApiMethod.GET)
    })

    it(`builds the correct URL with path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }))
      const svc = makeService(`https://api.example.com`)
      await svc.get({ path: `items` })
      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`https://api.example.com/items`)
    })

    it(`appends query params from data for GET`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }))
      const svc = makeService(`https://api.example.com`)
      await svc.get({ path: `/search`, data: { q: `hello`, page: 2 } })
      const [url] = mockFetch.mock.calls[0]
      expect(url).toContain(`q=hello`)
      expect(url).toContain(`page=2`)
    })

    it(`does not include body for GET`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }))
      const svc = makeService()
      await svc.get({ path: `/items`, data: { filter: `active` } })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.body).toBeUndefined()
    })

    it(`returns ok:true and unwrapped data on success`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: { id: 42 } }))
      const svc = makeService()
      const result = await svc.get({ path: `/item` })
      expect(result.ok).toBe(true)
      expect(result.status).toBe(200)
      expect(result.data).toEqual({ id: 42 })
      expect(result.error).toBeUndefined()
    })

    it(`returns raw response when responseType=text`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(`plain text`, 200))
      const svc = makeService()
      const result = await svc.get({ path: `/text`, responseType: `text` })
      expect(result.ok).toBe(true)
      expect(result.data).toBe(`plain text`)
    })

    it(`returns rawResponse data without envelope unwrapping`, async () => {
      const payload = { data: { id: 1 }, meta: { count: 1 } }
      mockFetch.mockResolvedValueOnce(makeResponse(payload))
      const svc = makeService()
      const result = await svc.get({ path: `/item`, rawResponse: true })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual(payload)
    })
  })

  // -------------------------------------------------------------------------
  // POST requests
  // -------------------------------------------------------------------------

  describe(`post`, () => {
    it(`calls fetch with POST method`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: { id: 1 } }))
      const svc = makeService()
      await svc.post({ path: `/items`, data: { name: `test` } })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.method).toBe(EApiMethod.POST)
    })

    it(`serialises data as JSON body`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: { id: 1 } }))
      const svc = makeService()
      await svc.post({ path: `/items`, data: { name: `test` } })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.body).toBe(JSON.stringify({ name: `test` }))
    })

    it(`sends FormData when form=true`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: {} }))
      const svc = makeService()
      await svc.post({ path: `/upload`, data: { file: `content` }, form: true })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.body).toBeInstanceOf(FormData)
    })

    it(`returns ok:true and data on 201`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: { id: 5 } }, 201))
      const svc = makeService()
      const result = await svc.post({ path: `/items`, data: {} })
      expect(result.ok).toBe(true)
      expect(result.status).toBe(201)
      expect(result.data).toEqual({ id: 5 })
    })
  })

  // -------------------------------------------------------------------------
  // PUT requests
  // -------------------------------------------------------------------------

  describe(`put`, () => {
    it(`calls fetch with PUT method`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: {} }))
      const svc = makeService()
      await svc.put({ path: `/items/1`, data: { name: `updated` } })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.method).toBe(EApiMethod.PUT)
    })

    it(`returns ok:true on success`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: { updated: true } }))
      const svc = makeService()
      const result = await svc.put({ path: `/items/1`, data: {} })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ updated: true })
    })
  })

  // -------------------------------------------------------------------------
  // DELETE requests
  // -------------------------------------------------------------------------

  describe(`delete`, () => {
    it(`calls fetch with DELETE method`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: {} }))
      const svc = makeService()
      await svc.delete({ path: `/items/1` })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.method).toBe(EApiMethod.DELETE)
    })

    it(`returns ok:true on success`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: { deleted: true } }))
      const svc = makeService()
      const result = await svc.delete({ path: `/items/1` })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ deleted: true })
    })
  })

  // -------------------------------------------------------------------------
  // PATCH requests
  // -------------------------------------------------------------------------

  describe(`patch`, () => {
    it(`calls fetch with PATCH method`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: {} }))
      const svc = makeService()
      await svc.patch({ path: `/items/1`, data: { active: false } })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.method).toBe(EApiMethod.PATCH)
    })

    it(`returns ok:true on success`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: { patched: true } }))
      const svc = makeService()
      const result = await svc.patch({ path: `/items/1`, data: {} })
      expect(result.ok).toBe(true)
      expect(result.data).toEqual({ patched: true })
    })
  })

  // -------------------------------------------------------------------------
  // basePath prepending
  // -------------------------------------------------------------------------

  describe(`basePath`, () => {
    it(`prepends basePath to the path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }))
      const svc = makeService(`https://api.example.com`, { basePath: `v2` })
      await svc.get({ path: `items` })
      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`https://api.example.com/v2/items`)
    })

    it(`works without a path when basePath is set`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }))
      const svc = makeService(`https://api.example.com`, { basePath: `v2` })
      await svc.get({})
      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`https://api.example.com/v2`)
    })

    it(`strips trailing slash from base url before joining`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }))
      const svc = makeService(`https://api.example.com/`, { basePath: `v1` })
      await svc.get({ path: `items` })
      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`https://api.example.com/v1/items`)
    })
  })

  // -------------------------------------------------------------------------
  // Envelope unwrapping
  // -------------------------------------------------------------------------

  describe(`envelope unwrapping`, () => {
    it(`unwraps { data } envelope from response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: [1, 2, 3] }))
      const svc = makeService()
      const result = await svc.get({ path: `/list` })
      expect(result.data).toEqual([1, 2, 3])
    })

    it(`includes meta fields alongside data`, async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse({ data: [1, 2], limit: 10, offset: 0 })
      )
      const svc = makeService()
      const result = (await svc.get({ path: `/list` })) as any
      expect(result.data).toEqual([1, 2])
      expect(result.limit).toBe(10)
      expect(result.offset).toBe(0)
    })

    it(`returns full body as data when no { data } key present`, async () => {
      const payload = { id: 1, name: `Alice` }
      mockFetch.mockResolvedValueOnce(makeResponse(payload))
      const svc = makeService()
      const result = await svc.get({ path: `/item` })
      expect(result.data).toEqual(payload)
    })

    it(`skips unwrapping when rawResponse=true`, async () => {
      const payload = { data: { id: 1 } }
      mockFetch.mockResolvedValueOnce(makeResponse(payload))
      const svc = makeService()
      const result = await svc.get({ path: `/item`, rawResponse: true })
      expect(result.data).toEqual(payload)
    })
  })

  // -------------------------------------------------------------------------
  // Error handling — HTTP errors
  // -------------------------------------------------------------------------

  describe(`HTTP error handling`, () => {
    it(`returns ok:false for 400 responses`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(`Bad Request`, 400, `Bad Request`))
      const svc = makeService()
      const result = await svc.get({ path: `/bad` })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(400)
      expect(result.data).toBeUndefined()
      expect(result.error).toBeInstanceOf(Exception)
      expect(result.error?.details).toBeDefined()
    })

    it(`returns ok:false for 401 responses`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(`Unauthorized`, 401, `Unauthorized`))
      const svc = makeService()
      const result = await svc.get({ path: `/protected` })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(401)
      expect(result.error).toBeInstanceOf(Exception)
    })

    it(`returns ok:false for 404 responses`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(`Not Found`, 404, `Not Found`))
      const svc = makeService()
      const result = await svc.get({ path: `/missing` })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(404)
      expect(result.error).toBeInstanceOf(Exception)
    })

    it(`returns ok:false for 500 responses`, async () => {
      mockFetch.mockResolvedValueOnce(
        makeResponse(`Internal Server Error`, 500, `Internal Server Error`)
      )
      const svc = makeService()
      const result = await svc.get({ path: `/crash` })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(500)
      expect(result.error).toBeInstanceOf(Exception)
    })

    it(`error has correct status code`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(`Not Found`, 404, `Not Found`))
      const svc = makeService()
      const result = await svc.get({ path: `/missing` })
      expect(result.error?.status).toBe(404)
    })

    it(`uses custom error message from opts.error`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(`Not Found`, 404, `Not Found`))
      const svc = makeService()
      const result = await svc.get({ path: `/missing`, error: `Item not found` })
      expect(result.error?.message).toContain(`Item not found`)
    })
  })

  // -------------------------------------------------------------------------
  // Error handling — network failures
  // -------------------------------------------------------------------------

  describe(`network failure handling`, () => {
    it(`returns ok:false with status 0 on network error`, async () => {
      mockFetch.mockRejectedValueOnce(new Error(`Network unavailable`))
      const svc = makeService()
      const result = await svc.get({ path: `/items` })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(0)
      expect(result.error).toBeInstanceOf(Exception)
    })

    it(`captures the network error message`, async () => {
      mockFetch.mockRejectedValueOnce(new Error(`ECONNREFUSED`))
      const svc = makeService()
      const result = await svc.get({ path: `/items` })
      expect(result.error?.message).toContain(`ECONNREFUSED`)
    })

    it(`does not throw on network failure`, async () => {
      mockFetch.mockRejectedValueOnce(new Error(`timeout`))
      const svc = makeService()
      await expect(svc.get({ path: `/items` })).resolves.toBeDefined()
    })
  })

  // -------------------------------------------------------------------------
  // Timeout
  // -------------------------------------------------------------------------

  describe(`timeout`, () => {
    it(`sets AbortSignal on fetch when timeout is provided`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: {} }))
      const svc = makeService()
      await svc.get({ path: `/items`, timeout: 5000 })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.signal).toBeDefined()
    })

    it(`does not set signal when timeout is absent`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: {} }))
      const svc = makeService()
      await svc.get({ path: `/items` })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.signal).toBeUndefined()
    })
  })

  // -------------------------------------------------------------------------
  // Header merging
  // -------------------------------------------------------------------------

  describe(`header merging`, () => {
    it(`merges instance headers with request-level headers`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: {} }))
      const svc = makeService(`https://api.example.com`, {
        headers: { 'X-Instance': `yes` },
      })
      await svc.get({ path: `/items`, headers: { 'X-Request': `yes` } })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.headers[`X-Instance`]).toBe(`yes`)
      expect(opts.headers[`X-Request`]).toBe(`yes`)
    })

    it(`request-level headers override instance headers`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: {} }))
      const svc = makeService(`https://api.example.com`, {
        headers: { Authorization: `Bearer old` },
      })
      await svc.get({ path: `/items`, headers: { Authorization: `Bearer new` } })
      const [, opts] = mockFetch.mock.calls[0]
      expect(opts.headers[`Authorization`]).toBe(`Bearer new`)
    })
  })

  // -------------------------------------------------------------------------
  // URL building edge cases
  // -------------------------------------------------------------------------

  describe(`URL building`, () => {
    it(`handles no path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: {} }))
      const svc = makeService(`https://api.example.com`)
      await svc.get({})
      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`https://api.example.com`)
    })

    it(`handles string query params (no ? prefix)`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: {} }))
      // Access protected method via subclass
      class TestService extends ApiService {
        testBuildUrl(path: string, params: string) {
          return this.buildUrl(path, params)
        }
      }
      const svc = new TestService({ url: `https://api.example.com` })
      const built = svc.testBuildUrl(`items`, `foo=bar`)
      expect(built).toBe(`https://api.example.com/items?foo=bar`)
    })

    it(`handles string query params with ? prefix already`, async () => {
      class TestService extends ApiService {
        testBuildUrl(path: string, params: string) {
          return this.buildUrl(path, params)
        }
      }
      const svc = new TestService({ url: `https://api.example.com` })
      const built = svc.testBuildUrl(`items`, `?foo=bar`)
      expect(built).toBe(`https://api.example.com/items?foo=bar`)
    })

    it(`strips leading slash from path`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse({ data: {} }))
      const svc = makeService(`https://api.example.com`)
      await svc.get({ path: `/items/1` })
      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`https://api.example.com/items/1`)
    })
  })

  // -------------------------------------------------------------------------
  // stream()
  // -------------------------------------------------------------------------

  describe(`stream`, () => {
    beforeEach(() => {
      vi.resetAllMocks()
    })

    it(`returns ok:true and response object for a 200 response`, async () => {
      const mockRes = makeResponse(null, 200)
      mockFetch.mockResolvedValueOnce(mockRes)
      const svc = makeService()
      const result = await svc.stream({ path: `/events` })
      expect(result.ok).toBe(true)
      expect(result.status).toBe(200)
      expect((result as any).response).toEqual(mockRes)
      expect(result.error).toBeUndefined()
    })

    it(`returns ok:false and error for a 4xx response`, async () => {
      mockFetch.mockResolvedValueOnce(makeResponse(`Not Found`, 404, `Not Found`))
      const svc = makeService()
      const result = await svc.stream({ path: `/events` })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(404)
      expect(result.error).toBeInstanceOf(Exception)
    })

    it(`returns ok:false with status 0 when fetch throws`, async () => {
      mockFetch.mockRejectedValueOnce(new Error(`Network error`))
      const svc = makeService()
      const result = await svc.stream({ path: `/events` })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(0)
      expect(result.error).toBeInstanceOf(Exception)
      expect(result.error?.message).toContain(`Network error`)
    })
  })

  // -------------------------------------------------------------------------
  // parseResponse JSON parse failure
  // -------------------------------------------------------------------------

  describe(`parseResponse JSON parse failure`, () => {
    beforeEach(() => {
      vi.resetAllMocks()
    })

    it(`returns ok:false with the real HTTP status (not 0) when json() rejects on a 200`, async () => {
      const mockRes = {
        ok: true,
        status: 200,
        statusText: `OK`,
        json: vi.fn().mockRejectedValue(new Error(`Unexpected token`)),
        text: vi.fn().mockRejectedValue(new Error(`Unexpected token`)),
      } as unknown as Response
      mockFetch.mockResolvedValueOnce(mockRes)
      const svc = makeService()
      const result = await svc.get({ path: `/bad-json` })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(200)
      expect(result.error).toBeInstanceOf(Exception)
      expect(result.error?.message).toContain(`Failed to parse response body`)
    })
  })

  // -------------------------------------------------------------------------
  // Unconfigured url guard
  // -------------------------------------------------------------------------

  describe(`invoke url guard`, () => {
    beforeEach(() => {
      vi.resetAllMocks()
    })

    it(`returns ok:false with status 0 when url is not configured`, async () => {
      const svc = new ApiService({ url: `` })
      const result = await svc.get({ path: `/items` })
      expect(result.ok).toBe(false)
      expect(result.status).toBe(0)
      expect(result.error).toBeInstanceOf(Exception)
      expect(result.error?.message).toContain(`url is not configured`)
      expect(mockFetch).not.toHaveBeenCalled()
    })
  })

  // -------------------------------------------------------------------------
  // Subclass override
  // -------------------------------------------------------------------------

  describe(`subclass override`, () => {
    it(`allows invoke to be overridden for custom behaviour (retry)`, async () => {
      let callCount = 0

      class RetryService extends ApiService {
        // @ts-expect-error — intentional override with simplified signature for test
        protected override async invoke(
          opts: Parameters<ApiService['get']>[0] & { method: EApiMethod }
        ) {
          callCount++
          if (callCount < 2) {
            return { ok: false, status: 503, error: new Exception(503, `retry`) }
          }
          return super.invoke(opts)
        }
      }

      mockFetch.mockResolvedValueOnce(makeResponse({ data: { id: 1 } }))
      const svc = new RetryService({ url: `https://api.example.com` })
      const result = await svc.get({ path: `/items` })
      // First call returned the error from our override
      expect(result.ok).toBe(false)
      expect(result.status).toBe(503)
    })

    it(`can override buildUrl to inject custom segments`, async () => {
      class VersionedService extends ApiService {
        protected override buildUrl(path = ``, params?: any): string {
          return super.buildUrl(`/api/v3/${path.replace(/^\//, ``)}`, params)
        }
      }

      mockFetch.mockResolvedValueOnce(makeResponse({ data: [] }))
      const svc = new VersionedService({ url: `https://api.example.com` })
      await svc.get({ path: `items` })
      const [url] = mockFetch.mock.calls[0]
      expect(url).toBe(`https://api.example.com/api/v3/items`)
    })
  })
})

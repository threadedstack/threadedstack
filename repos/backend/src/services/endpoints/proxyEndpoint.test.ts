import type { Response } from 'express'

import { EEndpointType } from '@tdsk/domain'
import { createProxyMiddleware } from 'http-proxy-middleware'
import { ProxyEndpoint } from '@TBE/services/endpoints/proxyEndpoint'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Mock logger
vi.mock(`@TBE/utils/logger`, () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}))

// Mock http-proxy-middleware
vi.mock(`http-proxy-middleware`, () => ({
  createProxyMiddleware: vi.fn(() => vi.fn((req: any, res: any, next: any) => next())),
  responseInterceptor: vi.fn((fn: any) => fn),
}))

// Mock proxy utils
vi.mock(`@TBE/utils/proxy`, () => ({
  addEndpointHeaders: vi.fn(),
  // The SSRF egress guard has its own dedicated suite (egressGuard.test.ts).
  // Here assertSafeEgressUrl is a pass-through, and guardedFetch delegates to the
  // (test-controlled) global fetch so the redirect-handling tests drive it as
  // before — the guard's real manual-follow behavior is covered by its own suite.
  assertSafeEgressUrl: vi.fn(async () => undefined),
  guardedFetch: vi.fn((url: string) => globalThis.fetch(url, { redirect: `follow` })),
}))

// Mock checkPermission
vi.mock(`@TBE/utils/auth/checkPermission`, () => ({
  checkPermission: vi.fn(),
}))

// Mock RetryService and ProxyService
vi.mock(`@TBE/services/proxy`, () => ({
  ProxyService: vi.fn().mockImplementation(() => ({
    applyEndpointOptions: vi.fn().mockReturnValue({}),
    applyEndpointOptionsAsync: vi.fn().mockResolvedValue(undefined),
    applyTransform: vi.fn((body: any) => body),
  })),
  RetryService: vi.fn().mockImplementation(() => ({
    meta: {
      get: vi.fn().mockReturnValue(null),
      update: vi.fn(),
      init: vi.fn(),
    },
    shouldRetry: vi.fn().mockReturnValue(false),
    delayRetry: vi.fn().mockResolvedValue(undefined),
    logStatus: vi.fn(),
  })),
}))

/**
 * Helper to create standard test fixtures for execute() calls
 */
const createFixtures = (overrides?: { url?: string; headersSent?: boolean }) => {
  const mockReq = {
    params: { 0: `` },
    method: `GET`,
    url: `/test`,
    headers: {},
  } as any
  const mockRes = { headersSent: overrides?.headersSent ?? false } as any
  const mockEndpoint = {
    type: EEndpointType.proxy,
    projectId: `p1`,
    options: { url: overrides?.url ?? `https://example.com` },
    headers: {},
  } as any
  const mockDb = {
    services: {
      secret: { list: vi.fn().mockResolvedValue({ data: [] }) },
    },
  } as any

  return { mockReq, mockRes, mockEndpoint, mockDb }
}

/**
 * Execute the proxy endpoint and extract the options passed to createProxyMiddleware
 */
const executeAndGetConfig = async (
  service: ProxyEndpoint,
  overrides?: Parameters<typeof createFixtures>[0]
) => {
  const fixtures = createFixtures(overrides)
  await service.execute(fixtures.mockReq, fixtures.mockRes, fixtures.mockEndpoint)
  const config = vi.mocked(createProxyMiddleware).mock.calls[0][0] as any
  return { config, ...fixtures }
}

describe(`ProxyEndpoint`, () => {
  let service: ProxyEndpoint

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProxyEndpoint({
      services: { secret: { list: vi.fn().mockResolvedValue({ data: [] }) } },
    } as any)
  })

  describe(`type`, () => {
    it(`should be proxy`, () => {
      expect(service.type).toBe(EEndpointType.proxy)
    })
  })

  describe(`validateOptions`, () => {
    it(`should pass when url is present`, () => {
      expect(() =>
        service.validateOptions({ url: `https://api.example.com` })
      ).not.toThrow()
    })

    it(`should throw when url is missing`, () => {
      expect(() => service.validateOptions({})).toThrow(
        `Proxy endpoint requires a url in options`
      )
    })

    it(`should throw when options is undefined`, () => {
      expect(() => service.validateOptions(undefined as any)).toThrow(
        `Proxy endpoint requires a url in options`
      )
    })

    it(`should throw when options is null`, () => {
      expect(() => service.validateOptions(null as any)).toThrow(
        `Proxy endpoint requires a url in options`
      )
    })

    it(`should pass when url is present along with other fields`, () => {
      expect(() =>
        service.validateOptions({
          url: `https://api.example.com`,
          timeout: 5000,
          retries: 3,
        })
      ).not.toThrow()
    })

    it(`should pass when proxyMethod is a valid HTTP method`, () => {
      expect(() =>
        service.validateOptions({ url: `https://api.example.com`, proxyMethod: `get` })
      ).not.toThrow()
    })

    it(`should pass when proxyMethod is post`, () => {
      expect(() =>
        service.validateOptions({ url: `https://api.example.com`, proxyMethod: `post` })
      ).not.toThrow()
    })

    it(`should throw 400 when proxyMethod is invalid`, () => {
      expect(() =>
        service.validateOptions({
          url: `https://api.example.com`,
          proxyMethod: `invalid`,
        })
      ).toThrow(`Invalid proxy method`)
    })

    it(`should pass when proxyMethod is absent`, () => {
      expect(() =>
        service.validateOptions({ url: `https://api.example.com` })
      ).not.toThrow()
    })
  })

  describe(`execute`, () => {
    it(`should throw when endpoint has no proxy configuration`, async () => {
      const mockReq = { params: {}, method: `GET`, url: `/test` } as any
      const mockRes = {} as Response
      const mockEndpoint = {
        type: EEndpointType.proxy,
        projectId: `p1`,
        options: {},
        headers: {},
      } as any

      await expect(service.execute(mockReq, mockRes, mockEndpoint)).rejects.toThrow(
        `Endpoint has no proxy configuration`
      )
    })
  })

  describe(`execute - proxy middleware configuration`, () => {
    it(`should set selfHandleResponse to true`, async () => {
      const { config } = await executeAndGetConfig(service)
      expect(config.selfHandleResponse).toBe(true)
    })

    it(`should not set followRedirects`, async () => {
      const { config } = await executeAndGetConfig(service)
      expect(config).not.toHaveProperty(`followRedirects`)
    })

    it(`should set changeOrigin to true`, async () => {
      const { config } = await executeAndGetConfig(service)
      expect(config.changeOrigin).toBe(true)
    })

    it(`should set the target to the endpoint url`, async () => {
      const { config } = await executeAndGetConfig(service, {
        url: `https://api.test.com`,
      })
      expect(config.target).toBe(`https://api.test.com`)
    })
  })

  describe(`execute - interceptor redirect handling`, () => {
    let originalFetch: typeof globalThis.fetch

    beforeEach(() => {
      originalFetch = globalThis.fetch
    })

    afterEach(() => {
      globalThis.fetch = originalFetch
    })

    /**
     * Helper to extract the interceptor callback after execute()
     */
    const getInterceptor = async (targetUrl = `https://example.com`) => {
      const { config } = await executeAndGetConfig(service, { url: targetUrl })
      return config.on.proxyRes as (
        responseBuffer: Buffer,
        proxyRes: any,
        request: any,
        response: any
      ) => Promise<Buffer | string>
    }

    /**
     * Helper to create a mock response object (simulates ServerResponse after copyHeaders ran)
     */
    const createMockResponse = (statusCode = 200, headerNames: string[] = []) => ({
      statusCode,
      getHeaderNames: vi.fn().mockReturnValue(headerNames),
      removeHeader: vi.fn(),
      setHeader: vi.fn(),
    })

    it(`should follow 301 redirects server-side via fetch`, async () => {
      const finalBody = `<html>Final Page</html>`
      const mockFetchRes = {
        status: 200,
        headers: new Headers({ 'content-type': `text/html` }),
        arrayBuffer: vi
          .fn()
          .mockResolvedValue(new TextEncoder().encode(finalBody).buffer),
      }
      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchRes)

      const interceptor = await getInterceptor()
      const mockResponse = createMockResponse(301, [`location`, `content-type`])

      const result = await interceptor(
        Buffer.from(`<html>Moved</html>`),
        { statusCode: 301, headers: { location: `https://www.example.com/` } },
        {},
        mockResponse
      )

      expect(globalThis.fetch).toHaveBeenCalledWith(`https://www.example.com/`, {
        redirect: `follow`,
      })
      expect(mockResponse.statusCode).toBe(200)
      expect(Buffer.from(result).toString()).toBe(finalBody)
    })

    it(`should follow 302 redirects server-side via fetch`, async () => {
      const finalBody = `{"ok":true}`
      const mockFetchRes = {
        status: 200,
        headers: new Headers({ 'content-type': `application/json` }),
        arrayBuffer: vi
          .fn()
          .mockResolvedValue(new TextEncoder().encode(finalBody).buffer),
      }
      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchRes)

      const interceptor = await getInterceptor()
      const mockResponse = createMockResponse(302, [`location`])

      const result = await interceptor(
        Buffer.from(``),
        { statusCode: 302, headers: { location: `https://other.example.com/api` } },
        {},
        mockResponse
      )

      expect(globalThis.fetch).toHaveBeenCalledWith(`https://other.example.com/api`, {
        redirect: `follow`,
      })
      expect(mockResponse.statusCode).toBe(200)
      expect(Buffer.from(result).toString()).toBe(finalBody)
    })

    it(`should clear old headers and set new headers from redirect response`, async () => {
      const mockFetchRes = {
        status: 200,
        headers: new Headers({
          'content-type': `text/html; charset=UTF-8`,
          'x-custom': `value`,
        }),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      }
      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchRes)

      const interceptor = await getInterceptor()
      const mockResponse = createMockResponse(301, [`location`, `content-type`, `server`])

      await interceptor(
        Buffer.from(``),
        { statusCode: 301, headers: { location: `https://other.com/` } },
        {},
        mockResponse
      )

      // Old headers should be removed
      expect(mockResponse.removeHeader).toHaveBeenCalledWith(`location`)
      expect(mockResponse.removeHeader).toHaveBeenCalledWith(`content-type`)
      expect(mockResponse.removeHeader).toHaveBeenCalledWith(`server`)

      // New headers from fetch response should be set
      expect(mockResponse.setHeader).toHaveBeenCalledWith(
        `content-type`,
        `text/html; charset=UTF-8`
      )
      expect(mockResponse.setHeader).toHaveBeenCalledWith(`x-custom`, `value`)
    })

    it(`should not set content-encoding or transfer-encoding from redirect response`, async () => {
      const mockFetchRes = {
        status: 200,
        headers: new Headers({
          'content-type': `text/html`,
          'content-encoding': `gzip`,
          'transfer-encoding': `chunked`,
        }),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      }
      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchRes)

      const interceptor = await getInterceptor()
      const mockResponse = createMockResponse(301, [`location`])

      await interceptor(
        Buffer.from(``),
        { statusCode: 301, headers: { location: `https://other.com/` } },
        {},
        mockResponse
      )

      const setHeaderCalls = mockResponse.setHeader.mock.calls.map(
        (call: any[]) => call[0]
      )
      expect(setHeaderCalls).not.toContain(`content-encoding`)
      expect(setHeaderCalls).not.toContain(`transfer-encoding`)
    })

    it(`should resolve relative redirect URLs against target URL`, async () => {
      const mockFetchRes = {
        status: 200,
        headers: new Headers({}),
        arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(0)),
      }
      globalThis.fetch = vi.fn().mockResolvedValue(mockFetchRes)

      const interceptor = await getInterceptor(`https://api.example.com`)
      const mockResponse = createMockResponse(301, [`location`])

      await interceptor(
        Buffer.from(``),
        { statusCode: 301, headers: { location: `/other-path` } },
        {},
        mockResponse
      )

      expect(globalThis.fetch).toHaveBeenCalledWith(
        `https://api.example.com/other-path`,
        { redirect: `follow` }
      )
    })

    it(`should not follow non-redirect responses`, async () => {
      globalThis.fetch = vi.fn()

      const interceptor = await getInterceptor()
      const buffer = Buffer.from(`response body`)

      const result = await interceptor(buffer, { statusCode: 200, headers: {} }, {}, {})

      expect(globalThis.fetch).not.toHaveBeenCalled()
      expect(result).toBe(buffer)
    })

    it(`should not follow 3xx without Location header`, async () => {
      globalThis.fetch = vi.fn()

      const interceptor = await getInterceptor()
      const buffer = Buffer.from(`response body`)

      const result = await interceptor(buffer, { statusCode: 301, headers: {} }, {}, {})

      expect(globalThis.fetch).not.toHaveBeenCalled()
      expect(result).toBe(buffer)
    })

    it(`should track status codes >= 400 for non-redirect responses`, async () => {
      globalThis.fetch = vi.fn()

      const interceptor = await getInterceptor()
      const mockRequest = {} as any

      await interceptor(
        Buffer.from(``),
        { statusCode: 502, headers: {} },
        mockRequest,
        {}
      )

      expect(mockRequest.__proxyStatusCode).toBe(502)
    })

    it(`should return original buffer when fetch fails`, async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error(`network error`))

      const interceptor = await getInterceptor()
      const buffer = Buffer.from(`<html>Moved</html>`)

      const result = await interceptor(
        buffer,
        { statusCode: 301, headers: { location: `https://bad.url/` } },
        {},
        createMockResponse(301, [`location`])
      )

      // Should fall through to the catch block and return original buffer
      expect(result).toBe(buffer)
    })
  })

  describe(`execute - retry loop headersSent guard`, () => {
    it(`should not retry when res.headersSent is true`, async () => {
      const mockRetryService = {
        meta: { get: vi.fn().mockReturnValue(null), update: vi.fn(), init: vi.fn() },
        shouldRetry: vi.fn().mockReturnValue(true),
        delayRetry: vi.fn().mockResolvedValue(undefined),
        logStatus: vi.fn(),
      }

      const { RetryService } = await import(`@TBE/services/proxy`)
      vi.mocked(RetryService).mockImplementationOnce(() => mockRetryService as any)

      // Make proxy middleware fail
      vi.mocked(createProxyMiddleware).mockReturnValueOnce(
        vi.fn((req: any, res: any, next: any) => next(new Error(`proxy error`))) as any
      )

      const { mockReq, mockRes, mockEndpoint } = createFixtures({
        headersSent: true,
      })

      // Should not throw because headersSent prevents retry + error send
      await service.execute(mockReq, mockRes, mockEndpoint)

      // shouldRetry should NOT be called — headersSent check comes first
      expect(mockRetryService.shouldRetry).not.toHaveBeenCalled()
      expect(mockRetryService.delayRetry).not.toHaveBeenCalled()
    })

    it(`should retry when res.headersSent is false and shouldRetry is true`, async () => {
      let callCount = 0
      const mockRetryService = {
        meta: {
          get: vi.fn().mockReturnValue({ attempt: 1 }),
          update: vi.fn(),
          init: vi.fn(),
        },
        shouldRetry: vi.fn().mockReturnValue(true),
        delayRetry: vi.fn().mockResolvedValue(undefined),
        logStatus: vi.fn(),
      }

      const { RetryService } = await import(`@TBE/services/proxy`)
      vi.mocked(RetryService).mockImplementationOnce(() => mockRetryService as any)

      // First call fails, second succeeds
      vi.mocked(createProxyMiddleware)
        .mockReturnValueOnce(
          vi.fn((req: any, res: any, next: any) => {
            callCount++
            next(new Error(`proxy error`))
          }) as any
        )
        .mockReturnValueOnce(
          vi.fn((req: any, res: any, next: any) => {
            callCount++
            next()
          }) as any
        )

      const { mockReq, mockRes, mockEndpoint } = createFixtures({
        headersSent: false,
      })

      await service.execute(mockReq, mockRes, mockEndpoint)

      expect(callCount).toBe(2)
      expect(mockRetryService.shouldRetry).toHaveBeenCalled()
      expect(mockRetryService.delayRetry).toHaveBeenCalled()
    })
  })
})

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockCreateProxyMiddleware, mockAdminPath, mockSetAuthHeaders, mockLogger } =
  vi.hoisted(() => ({
    mockCreateProxyMiddleware: vi.fn(() => `proxy-middleware-instance`),
    mockAdminPath: vi.fn(),
    mockSetAuthHeaders: vi.fn(),
    mockLogger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }))

vi.mock(`http-proxy-middleware`, () => ({
  createProxyMiddleware: mockCreateProxyMiddleware,
}))

vi.mock(`@tdsk/domain`, () => ({
  adminPath: mockAdminPath,
  setAuthHeaders: mockSetAuthHeaders,
}))

vi.mock(`@TPX/utils/logger`, () => ({
  logger: mockLogger,
}))

import { setupProxy } from './setupProxy'

const buildMockApp = (overrides: Record<string, any> = {}) => {
  const backendConfig = {
    url: `http://localhost:5885`,
    headerKey: `x-backend-key`,
    headerValue: `secret-value`,
    adminPath: `_`,
    ...overrides,
  }

  return {
    use: vi.fn(),
    locals: {
      config: {
        backend: backendConfig,
      },
    },
  } as any
}

describe(`setupProxy`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should call app.use with the correct path prefix from adminPath`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    expect(mockAdminPath).toHaveBeenCalledWith(app.locals.config.backend)
    expect(app.use).toHaveBeenCalledTimes(1)

    const [pathArg] = app.use.mock.calls[0]
    expect(pathArg).toBe(`/_`)
  })

  it(`should normalize a trailing slash from adminPath result`, () => {
    mockAdminPath.mockReturnValue(`/admin/`)
    const app = buildMockApp()

    setupProxy(app)

    const [pathArg] = app.use.mock.calls[0]
    expect(pathArg).toBe(`/admin`)
  })

  it(`should normalize a bare path without leading slash`, () => {
    mockAdminPath.mockReturnValue(`api`)
    const app = buildMockApp()

    setupProxy(app)

    const [pathArg] = app.use.mock.calls[0]
    expect(pathArg).toBe(`/api`)
  })

  it(`should normalize a path with both leading and trailing slashes`, () => {
    mockAdminPath.mockReturnValue(`/custom/`)
    const app = buildMockApp()

    setupProxy(app)

    const [pathArg] = app.use.mock.calls[0]
    expect(pathArg).toBe(`/custom`)
  })

  it(`should handle a single slash from adminPath`, () => {
    mockAdminPath.mockReturnValue(`/`)
    const app = buildMockApp()

    setupProxy(app)

    const [pathArg] = app.use.mock.calls[0]
    expect(pathArg).toBe(`/`)
  })

  it(`should create proxy middleware with the correct target URL`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp({ url: `http://backend-host:9000` })

    setupProxy(app)

    expect(mockCreateProxyMiddleware).toHaveBeenCalledTimes(1)

    const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
      string,
      any
    >
    expect(proxyOptions.target).toBe(`http://backend-host:9000`)
  })

  it(`should enable websocket support in proxy options`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
      string,
      any
    >
    expect(proxyOptions.ws).toBe(true)
  })

  it(`should enable changeOrigin and xfwd in proxy options`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
      string,
      any
    >
    expect(proxyOptions.changeOrigin).toBe(true)
    expect(proxyOptions.xfwd).toBe(true)
  })

  it(`should pass the logger instance to proxy options`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
      string,
      any
    >
    expect(proxyOptions.logger).toBe(mockLogger)
  })

  it(`should register the proxy middleware on app.use`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const [, middlewareArg] = app.use.mock.calls[0]
    expect(middlewareArg).toBe(`proxy-middleware-instance`)
  })

  it(`should provide a pathRewrite function in proxy options`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
      string,
      any
    >
    expect(proxyOptions.pathRewrite).toBeTypeOf(`function`)
  })

  it(`should rewrite path to req.originalUrl`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
      string,
      any
    >
    const mockReq = { originalUrl: `/_/orgs?limit=10` }
    const result = proxyOptions.pathRewrite(`/_/orgs`, mockReq)
    expect(result).toBe(`/_/orgs?limit=10`)
  })

  it(`should attach error, proxyReq, and proxyRes event handlers`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
      string,
      any
    >
    expect(proxyOptions.on).toBeDefined()
    expect(proxyOptions.on.error).toBeTypeOf(`function`)
    expect(proxyOptions.on.proxyReq).toBeTypeOf(`function`)
    expect(proxyOptions.on.proxyRes).toBeTypeOf(`function`)
  })

  describe(`proxy event handlers`, () => {
    it(`should call setAuthHeaders on proxyReq`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
        string,
        any
      >
      const mockProxyReq = { setHeader: vi.fn() }
      const mockReq = { headers: {} }

      proxyOptions.on.proxyReq(mockProxyReq, mockReq)

      expect(mockSetAuthHeaders).toHaveBeenCalledWith(mockProxyReq, mockReq)
    })

    it(`should set backend header when headerKey and headerValue are configured`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp({
        headerKey: `x-proxy-secret`,
        headerValue: `my-secret`,
      })

      setupProxy(app)

      const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
        string,
        any
      >
      const mockProxyReq = { setHeader: vi.fn() }
      const mockReq = { headers: {} }

      proxyOptions.on.proxyReq(mockProxyReq, mockReq)

      expect(mockProxyReq.setHeader).toHaveBeenCalledWith(`x-proxy-secret`, `my-secret`)
    })

    it(`should not set backend header when headerKey is missing`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp({
        headerKey: ``,
        headerValue: `my-secret`,
      })

      setupProxy(app)

      const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
        string,
        any
      >
      const mockProxyReq = { setHeader: vi.fn() }
      const mockReq = { headers: {} }

      proxyOptions.on.proxyReq(mockProxyReq, mockReq)

      expect(mockProxyReq.setHeader).not.toHaveBeenCalled()
    })

    it(`should log debug message on proxyRes`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
        string,
        any
      >
      const mockProxyRes = { statusCode: 200 }
      const mockReq = { method: `GET`, url: `/_/orgs` }

      proxyOptions.on.proxyRes(mockProxyRes, mockReq)

      expect(mockLogger.debug).toHaveBeenCalledWith(`Proxy response: GET /_/orgs -> 200`)
    })

    it(`should log error and send 502 on proxy error`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
        string,
        any
      >
      const mockErr = new Error(`ECONNREFUSED`)
      const mockReq = {}
      const mockRes = {
        headersSent: false,
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      proxyOptions.on.error(mockErr, mockReq, mockRes)

      expect(mockLogger.error).toHaveBeenCalledWith(`Proxy error: ECONNREFUSED`, {
        stack: mockErr.stack,
      })
      expect(mockRes.writeHead).toHaveBeenCalledWith(502, {
        'Content-Type': `application/json`,
      })
      expect(mockRes.end).toHaveBeenCalledWith(
        JSON.stringify({ error: `Backend service unavailable` })
      )
    })

    it(`should not write response if headers already sent`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
        string,
        any
      >
      const mockErr = new Error(`timeout`)
      const mockReq = {}
      const mockRes = {
        headersSent: true,
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      proxyOptions.on.error(mockErr, mockReq, mockRes)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockRes.writeHead).not.toHaveBeenCalled()
      expect(mockRes.end).not.toHaveBeenCalled()
    })

    it(`should handle null response in error handler`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const proxyOptions = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
        string,
        any
      >
      const mockErr = new Error(`connection lost`)
      const mockReq = {}

      expect(() => proxyOptions.on.error(mockErr, mockReq, null)).not.toThrow()
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })
})

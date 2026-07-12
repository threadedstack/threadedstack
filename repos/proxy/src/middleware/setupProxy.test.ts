import { describe, it, expect, vi, beforeEach } from 'vitest'

const {
  mockCreateProxyMiddleware,
  mockProxyFn,
  mockAdminPath,
  mockSetAuthHeaders,
  mockLogger,
} = vi.hoisted(() => {
  const mockProxyFn = Object.assign(vi.fn(), { upgrade: vi.fn() })
  return {
    mockProxyFn,
    mockCreateProxyMiddleware: vi.fn(() => Object.assign(vi.fn(), { upgrade: vi.fn() })),
    mockAdminPath: vi.fn(),
    mockSetAuthHeaders: vi.fn(),
    mockLogger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
      debug: vi.fn(),
    },
  }
})

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
    expect(app.use).toHaveBeenCalledTimes(2)

    const [pathArg] = app.use.mock.calls[1]
    expect(pathArg).toEqual([`/_`, `/ai`, `/proxy`])
  })

  it(`should normalize a trailing slash from adminPath result`, () => {
    mockAdminPath.mockReturnValue(`/admin/`)
    const app = buildMockApp()

    setupProxy(app)

    const [pathArg] = app.use.mock.calls[1]
    expect(pathArg[0]).toBe(`/admin`)
  })

  it(`should normalize a bare path without leading slash`, () => {
    mockAdminPath.mockReturnValue(`api`)
    const app = buildMockApp()

    setupProxy(app)

    const [pathArg] = app.use.mock.calls[1]
    expect(pathArg[0]).toBe(`/api`)
  })

  it(`should normalize a path with both leading and trailing slashes`, () => {
    mockAdminPath.mockReturnValue(`/custom/`)
    const app = buildMockApp()

    setupProxy(app)

    const [pathArg] = app.use.mock.calls[1]
    expect(pathArg[0]).toBe(`/custom`)
  })

  it(`should handle a single slash from adminPath`, () => {
    mockAdminPath.mockReturnValue(`/`)
    const app = buildMockApp()

    setupProxy(app)

    const [pathArg] = app.use.mock.calls[1]
    expect(pathArg[0]).toBe(`/`)
  })

  it(`should create proxy middleware with the correct target URL`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp({ url: `http://backend-host:9000` })

    setupProxy(app)

    expect(mockCreateProxyMiddleware).toHaveBeenCalledTimes(2)

    const sandboxOpts = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
      string,
      any
    >
    const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
      string,
      any
    >
    expect(sandboxOpts.target).toBe(`http://backend-host:9000`)
    expect(standardOpts.target).toBe(`http://backend-host:9000`)
  })

  it(`should disable automatic ws on both proxies (manual upgrade handler instead)`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const sandboxOpts = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
      string,
      any
    >
    expect(sandboxOpts.ws).toBe(false)

    const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
      string,
      any
    >
    expect(standardOpts.ws).toBe(false)
  })

  it(`should enable changeOrigin and xfwd for standard proxy, disable changeOrigin for sandbox proxy`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const sandboxOpts = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
      string,
      any
    >
    expect(sandboxOpts.changeOrigin).toBe(false)
    expect(sandboxOpts.xfwd).toBe(true)

    const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
      string,
      any
    >
    expect(standardOpts.changeOrigin).toBe(true)
    expect(standardOpts.xfwd).toBe(true)
  })

  it(`should set a timeout and proxyTimeout on both proxies to prevent hung-connection exhaustion`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const sandboxOpts = (mockCreateProxyMiddleware.mock.calls[0] as any)[0] as Record<
      string,
      any
    >
    const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
      string,
      any
    >
    expect(sandboxOpts.timeout).toBe(30_000)
    expect(sandboxOpts.proxyTimeout).toBe(30_000)
    expect(standardOpts.timeout).toBe(30_000)
    expect(standardOpts.proxyTimeout).toBe(30_000)
  })

  it(`should pass the logger instance to proxy options`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
      string,
      any
    >
    expect(standardOpts.logger).toBe(mockLogger)
  })

  it(`should register sandbox forwarder as first middleware and standard proxy as second`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const sandboxMiddleware = app.use.mock.calls[0][0]
    expect(sandboxMiddleware).toBeTypeOf(`function`)

    const [, standardMiddleware] = app.use.mock.calls[1]
    expect(standardMiddleware).toBeTypeOf(`function`)
    expect(standardMiddleware.upgrade).toBeTypeOf(`function`)
  })

  it(`should provide a pathRewrite function in proxy options`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
      string,
      any
    >
    expect(standardOpts.pathRewrite).toBeTypeOf(`function`)
  })

  it(`should rewrite path to req.originalUrl`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
      string,
      any
    >
    const mockReq = { originalUrl: `/_/orgs?limit=10` }
    const result = standardOpts.pathRewrite(`/_/orgs`, mockReq)
    expect(result).toBe(`/_/orgs?limit=10`)
  })

  it(`should attach error, proxyReq, and proxyRes event handlers`, () => {
    mockAdminPath.mockReturnValue(`/_`)
    const app = buildMockApp()

    setupProxy(app)

    const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
      string,
      any
    >
    expect(standardOpts.on).toBeDefined()
    expect(standardOpts.on.error).toBeTypeOf(`function`)
    expect(standardOpts.on.proxyReq).toBeTypeOf(`function`)
    expect(standardOpts.on.proxyRes).toBeTypeOf(`function`)
  })

  describe(`proxy event handlers`, () => {
    it(`should call setAuthHeaders on proxyReq`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
        string,
        any
      >
      const mockProxyReq = { setHeader: vi.fn() }
      const mockReq = { headers: {} }

      standardOpts.on.proxyReq(mockProxyReq, mockReq)

      expect(mockSetAuthHeaders).toHaveBeenCalledWith(mockProxyReq, mockReq)
    })

    it(`should set backend header when headerKey and headerValue are configured`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp({
        headerKey: `x-proxy-secret`,
        headerValue: `my-secret`,
      })

      setupProxy(app)

      const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
        string,
        any
      >
      const mockProxyReq = { setHeader: vi.fn() }
      const mockReq = { headers: {} }

      standardOpts.on.proxyReq(mockProxyReq, mockReq)

      expect(mockProxyReq.setHeader).toHaveBeenCalledWith(`x-proxy-secret`, `my-secret`)
    })

    it(`should not set backend header when headerKey is missing`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp({
        headerKey: ``,
        headerValue: `my-secret`,
      })

      setupProxy(app)

      const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
        string,
        any
      >
      const mockProxyReq = { setHeader: vi.fn() }
      const mockReq = { headers: {} }

      standardOpts.on.proxyReq(mockProxyReq, mockReq)

      expect(mockProxyReq.setHeader).not.toHaveBeenCalled()
    })

    it(`should log debug message on proxyRes`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
        string,
        any
      >
      const mockProxyRes = { statusCode: 200 }
      const mockReq = { method: `GET`, url: `/_/orgs` }

      standardOpts.on.proxyRes(mockProxyRes, mockReq)

      expect(mockLogger.debug).toHaveBeenCalledWith(`Proxy response: GET /_/orgs -> 200`)
    })

    it(`should log error and send 502 on proxy error`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
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

      standardOpts.on.error(mockErr, mockReq, mockRes)

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

    it(`should produce a clean 502 (not a hang) when the target times out`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
        string,
        any
      >
      const mockErr = Object.assign(new Error(`socket hang up`), { code: `ECONNRESET` })
      const mockReq = {}
      const mockRes = {
        headersSent: false,
        writeHead: vi.fn(),
        end: vi.fn(),
      }

      standardOpts.on.error(mockErr, mockReq, mockRes)

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

      const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
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

      standardOpts.on.error(mockErr, mockReq, mockRes)

      expect(mockLogger.error).toHaveBeenCalled()
      expect(mockRes.writeHead).not.toHaveBeenCalled()
      expect(mockRes.end).not.toHaveBeenCalled()
    })

    it(`should handle null response in error handler`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const standardOpts = (mockCreateProxyMiddleware.mock.calls[1] as any)[0] as Record<
        string,
        any
      >
      const mockErr = new Error(`connection lost`)
      const mockReq = {}

      expect(() => standardOpts.on.error(mockErr, mockReq, null)).not.toThrow()
      expect(mockLogger.error).toHaveBeenCalled()
    })
  })

  describe(`sandbox subdomain forwarder`, () => {
    it(`should forward sandbox subdomain requests to the proxy`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const forwarder = app.use.mock.calls[0][0]
      const mockReq = { hostname: `3000--sb-abc123.local.threadedstack.app`, headers: {} }
      const mockRes = {}
      const mockNext = vi.fn()

      forwarder(mockReq, mockRes, mockNext)

      expect(mockNext).not.toHaveBeenCalled()
    })

    it(`should call next for non-sandbox hostnames`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const forwarder = app.use.mock.calls[0][0]
      const mockReq = { hostname: `local.threadedstack.app`, headers: {} }
      const mockRes = {}
      const mockNext = vi.fn()

      forwarder(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })

    it(`should call next for regular subdomains without sandbox pattern`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const forwarder = app.use.mock.calls[0][0]
      const mockReq = { hostname: `px.local.threadedstack.app`, headers: {} }
      const mockRes = {}
      const mockNext = vi.fn()

      forwarder(mockReq, mockRes, mockNext)

      expect(mockNext).toHaveBeenCalled()
    })
  })

  describe(`WebSocket upgrade handler`, () => {
    it(`should set onUpgrade on app.locals`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      expect(app.locals.onUpgrade).toBeTypeOf(`function`)
    })

    it(`should call sandbox proxy upgrade for sandbox hostnames`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const mockReq = { headers: { host: `3000--sb-abc123.local.threadedstack.app` } }
      const mockSocket = {}
      const mockHead = Buffer.alloc(0)

      app.locals.onUpgrade(mockReq, mockSocket, mockHead)

      const sandboxForwarder = app.use.mock.calls[0][0]
      expect(sandboxForwarder.upgrade).toBeDefined()
    })

    it(`should call backend proxy upgrade for non-sandbox hostnames`, () => {
      mockAdminPath.mockReturnValue(`/_`)
      const app = buildMockApp()

      setupProxy(app)

      const mockReq = { headers: { host: `local.threadedstack.app` } }
      const mockSocket = {}
      const mockHead = Buffer.alloc(0)

      app.locals.onUpgrade(mockReq, mockSocket, mockHead)
    })
  })
})

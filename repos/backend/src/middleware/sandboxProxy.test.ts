import type { TApp } from '@TBE/types'
import type { Request, Response, NextFunction } from 'express'

import { logger } from '@TBE/utils/logger'
import { parseSandboxHost } from '@tdsk/sandbox'
import { setupSandboxProxy } from './sandboxProxy'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SandboxService } from '@TBE/services/sandboxes/sandbox'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

vi.mock(`@tdsk/sandbox`, () => ({
  parseSandboxHost: vi.fn(),
}))

vi.mock(`@TBE/services/sandboxes/sandbox`, () => ({
  SandboxService: {
    getPodProxy: vi.fn(),
  },
}))

const routes = {
  'sb-abc12345-xxxx': {
    meta: {
      podIp: `10.0.0.5`,
      state: `Running`,
      sandboxId: `abc12345`,
      podName: `tdsk-sb-abc12345-xxxx`,
    },
    placeholders: {},
    ports: {
      '3000': { host: `10.0.0.5`, port: 3000, protocol: `http` },
    },
  },
}

describe(`sandboxProxy middleware`, () => {
  let middleware: (req: Request, res: Response, next: NextFunction) => void
  let mockNext: ReturnType<typeof vi.fn>
  let mockJson: ReturnType<typeof vi.fn>
  let mockStatus: ReturnType<typeof vi.fn>
  let mockRes: Partial<Response>

  const buildMockReq = (overrides: Record<string, any> = {}) => {
    return {
      hostname: ``,
      headers: {},
      ...overrides,
    } as unknown as Request
  }

  const buildMockApp = (locals: Record<string, any> = {}) => {
    let capturedMiddleware: any
    const app = {
      use: vi.fn((fn: any) => {
        capturedMiddleware = fn
      }),
      locals,
    } as unknown as TApp

    setupSandboxProxy(app)
    return { app, middleware: capturedMiddleware }
  }

  beforeEach(() => {
    vi.clearAllMocks()
    mockJson = vi.fn()
    mockStatus = vi.fn(() => ({ json: mockJson }) as any)
    mockRes = { status: mockStatus } as Partial<Response>
    mockNext = vi.fn()

    const result = buildMockApp({ kube: { routes } })
    middleware = result.middleware
  })

  describe(`request routing`, () => {
    it(`should call next when hostname is empty`, () => {
      const req = buildMockReq({ hostname: ``, headers: {} })

      middleware(req, mockRes as Response, mockNext as NextFunction)

      expect(mockNext).toHaveBeenCalledWith()
      expect(mockStatus).not.toHaveBeenCalled()
    })

    it(`should call next when hostname is undefined`, () => {
      const req = buildMockReq({ hostname: undefined, headers: {} })

      middleware(req, mockRes as Response, mockNext as NextFunction)

      expect(mockNext).toHaveBeenCalledWith()
      expect(mockStatus).not.toHaveBeenCalled()
    })

    it(`should call next when parseSandboxHost returns null`, () => {
      vi.mocked(parseSandboxHost).mockReturnValue(null as any)
      const req = buildMockReq({ hostname: `api.threadedstack.app` })

      middleware(req, mockRes as Response, mockNext as NextFunction)

      expect(parseSandboxHost).toHaveBeenCalledWith(`api.threadedstack.app`)
      expect(mockNext).toHaveBeenCalledWith()
      expect(mockStatus).not.toHaveBeenCalled()
    })

    it(`should call next when app.locals.kube is undefined`, () => {
      const { middleware: mw } = buildMockApp({})
      vi.mocked(parseSandboxHost).mockReturnValue({
        port: `3000`,
        subdomain: `sb-abc12345-xxxx`,
      })
      const req = buildMockReq({
        hostname: `p3000-sb-abc12345-xxxx.local.threadedstack.app`,
      })

      mw(req, mockRes as Response, mockNext as NextFunction)

      expect(mockNext).toHaveBeenCalledWith()
      expect(mockStatus).not.toHaveBeenCalled()
    })

    it(`should call next when app.locals.kube.routes is undefined`, () => {
      const { middleware: mw } = buildMockApp({ kube: {} })
      vi.mocked(parseSandboxHost).mockReturnValue({
        port: `3000`,
        subdomain: `sb-abc12345-xxxx`,
      })
      const req = buildMockReq({
        hostname: `p3000-sb-abc12345-xxxx.local.threadedstack.app`,
      })

      mw(req, mockRes as Response, mockNext as NextFunction)

      expect(mockNext).toHaveBeenCalledWith()
      expect(mockStatus).not.toHaveBeenCalled()
    })

    it(`should return 404 with "Sandbox not found" when subdomain not in routes`, () => {
      vi.mocked(parseSandboxHost).mockReturnValue({
        port: `3000`,
        subdomain: `sb-unknown-xxxx`,
      })
      const req = buildMockReq({
        hostname: `p3000-sb-unknown-xxxx.local.threadedstack.app`,
      })

      middleware(req, mockRes as Response, mockNext as NextFunction)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({ error: `Sandbox not found` })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it(`should return 404 with port error when port not exposed on sandbox`, () => {
      vi.mocked(parseSandboxHost).mockReturnValue({
        port: `8080`,
        subdomain: `sb-abc12345-xxxx`,
      })
      const req = buildMockReq({
        hostname: `p8080-sb-abc12345-xxxx.local.threadedstack.app`,
      })

      middleware(req, mockRes as Response, mockNext as NextFunction)

      expect(mockStatus).toHaveBeenCalledWith(404)
      expect(mockJson).toHaveBeenCalledWith({
        error: `Port 8080 not exposed on this sandbox`,
      })
      expect(mockNext).not.toHaveBeenCalled()
    })

    it(`should proxy to correct target when route and port are found`, () => {
      const mockProxyHandler = vi.fn()
      vi.mocked(SandboxService.getPodProxy).mockReturnValue(mockProxyHandler as any)
      vi.mocked(parseSandboxHost).mockReturnValue({
        port: `3000`,
        subdomain: `sb-abc12345-xxxx`,
      })
      const req = buildMockReq({
        hostname: `p3000-sb-abc12345-xxxx.local.threadedstack.app`,
      })

      middleware(req, mockRes as Response, mockNext as NextFunction)

      expect(SandboxService.getPodProxy).toHaveBeenCalledWith(`http://10.0.0.5:3000`)
      expect(mockProxyHandler).toHaveBeenCalledWith(req, mockRes, mockNext)
      expect(mockStatus).not.toHaveBeenCalled()
    })

    it(`should fall back to headers.host when hostname is falsy`, () => {
      vi.mocked(parseSandboxHost).mockReturnValue(null as any)
      const req = buildMockReq({
        hostname: ``,
        headers: { host: `api.threadedstack.app:443` },
      })

      middleware(req, mockRes as Response, mockNext as NextFunction)

      expect(parseSandboxHost).toHaveBeenCalledWith(`api.threadedstack.app`)
    })
  })

  describe(`logging`, () => {
    it(`should log error with host and routes when route not found`, () => {
      vi.mocked(parseSandboxHost).mockReturnValue({
        port: `3000`,
        subdomain: `sb-missing-xxxx`,
      })
      const host = `p3000-sb-missing-xxxx.local.threadedstack.app`
      const req = buildMockReq({ hostname: host })

      middleware(req, mockRes as Response, mockNext as NextFunction)

      expect(logger.error).toHaveBeenCalledWith(
        `Could not find route from subdomain "sb-missing-xxxx"`,
        { host, routes }
      )
    })

    it(`should log error with host and route when port not found`, () => {
      vi.mocked(parseSandboxHost).mockReturnValue({
        port: `9999`,
        subdomain: `sb-abc12345-xxxx`,
      })
      const host = `p9999-sb-abc12345-xxxx.local.threadedstack.app`
      const req = buildMockReq({ hostname: host })

      middleware(req, mockRes as Response, mockNext as NextFunction)

      expect(logger.error).toHaveBeenCalledWith(
        `Port "9999" not exposed on this sandbox with subdomain "sb-abc12345-xxxx"`,
        { host, route: routes[`sb-abc12345-xxxx`] }
      )
    })

    it(`should not log when host is absent`, () => {
      const req = buildMockReq({ hostname: ``, headers: {} })

      middleware(req, mockRes as Response, mockNext as NextFunction)

      expect(logger.error).not.toHaveBeenCalled()
    })

    it(`should not log when parseSandboxHost returns null`, () => {
      vi.mocked(parseSandboxHost).mockReturnValue(null as any)
      const req = buildMockReq({ hostname: `api.threadedstack.app` })

      middleware(req, mockRes as Response, mockNext as NextFunction)

      expect(logger.error).not.toHaveBeenCalled()
    })

    it(`should not log when routes are absent`, () => {
      const { middleware: mw } = buildMockApp({})
      vi.mocked(parseSandboxHost).mockReturnValue({
        port: `3000`,
        subdomain: `sb-abc12345-xxxx`,
      })
      const req = buildMockReq({
        hostname: `p3000-sb-abc12345-xxxx.local.threadedstack.app`,
      })

      mw(req, mockRes as Response, mockNext as NextFunction)

      expect(logger.error).not.toHaveBeenCalled()
    })
  })

  describe(`proxy delegation`, () => {
    it(`should call SandboxService.getPodProxy with correct target URL`, () => {
      const mockProxyHandler = vi.fn()
      vi.mocked(SandboxService.getPodProxy).mockReturnValue(mockProxyHandler as any)
      vi.mocked(parseSandboxHost).mockReturnValue({
        port: `3000`,
        subdomain: `sb-abc12345-xxxx`,
      })
      const req = buildMockReq({
        hostname: `p3000-sb-abc12345-xxxx.local.threadedstack.app`,
      })

      middleware(req, mockRes as Response, mockNext as NextFunction)

      expect(SandboxService.getPodProxy).toHaveBeenCalledWith(`http://10.0.0.5:3000`)
    })

    it(`should pass req, res, next to the proxy handler`, () => {
      const mockProxyHandler = vi.fn()
      vi.mocked(SandboxService.getPodProxy).mockReturnValue(mockProxyHandler as any)
      vi.mocked(parseSandboxHost).mockReturnValue({
        port: `3000`,
        subdomain: `sb-abc12345-xxxx`,
      })
      const req = buildMockReq({
        hostname: `p3000-sb-abc12345-xxxx.local.threadedstack.app`,
      })

      middleware(req, mockRes as Response, mockNext as NextFunction)

      expect(mockProxyHandler).toHaveBeenCalledTimes(1)
      expect(mockProxyHandler).toHaveBeenCalledWith(req, mockRes, mockNext)
    })

    it(`should construct target with the protocol from portEntry`, () => {
      const httpsRoutes = {
        'sb-secure-xxxx': {
          meta: {
            podIp: `10.0.0.10`,
            state: `Running`,
            sandboxId: `secure`,
            podName: `tdsk-sb-secure-xxxx`,
          },
          placeholders: {},
          ports: {
            '443': { host: `10.0.0.10`, port: 443, protocol: `https` },
          },
        },
      }
      const { middleware: mw } = buildMockApp({ kube: { routes: httpsRoutes } })
      const mockProxyHandler = vi.fn()
      vi.mocked(SandboxService.getPodProxy).mockReturnValue(mockProxyHandler as any)
      vi.mocked(parseSandboxHost).mockReturnValue({
        port: `443`,
        subdomain: `sb-secure-xxxx`,
      })
      const req = buildMockReq({
        hostname: `p443-sb-secure-xxxx.local.threadedstack.app`,
      })

      mw(req, mockRes as Response, mockNext as NextFunction)

      expect(SandboxService.getPodProxy).toHaveBeenCalledWith(`https://10.0.0.10:443`)
      expect(mockProxyHandler).toHaveBeenCalledWith(req, mockRes, mockNext)
    })
  })
})

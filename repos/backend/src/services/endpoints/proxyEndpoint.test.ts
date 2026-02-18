import type { Response } from 'express'

import { EEndpointType } from '@tdsk/domain'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ProxyEndpoint } from '@TBE/services/endpoints/proxyEndpoint'

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

describe(`ProxyEndpoint`, () => {
  let service: ProxyEndpoint

  beforeEach(() => {
    vi.clearAllMocks()
    service = new ProxyEndpoint()
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
      const mockDb = {
        services: {
          secret: { list: vi.fn().mockResolvedValue({ data: [] }) },
        },
      } as any

      await expect(
        service.execute(mockReq, mockRes, mockEndpoint, mockDb)
      ).rejects.toThrow(`Endpoint has no proxy configuration`)
    })
  })
})

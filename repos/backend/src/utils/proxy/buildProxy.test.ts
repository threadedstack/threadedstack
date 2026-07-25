import type { TEndpointConfig } from '@TBE/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockConfig } = vi.hoisted(() => ({
  mockConfig: {
    proxy: { headerKey: ``, headerValue: `` },
    server: { origins: [] as string[] },
  },
}))

vi.mock(`@TBE/server/app`, () => ({
  app: { locals: { config: mockConfig } },
}))

vi.mock(`@TBE/utils/proxy/proxyError`, () => ({
  proxyError: vi.fn(),
}))

vi.mock(`@TBE/utils/proxy/proxyHeaders`, () => ({
  addProxyHeader: vi.fn(),
  addOriginHeader: vi.fn(),
}))

vi.mock(`@tdsk/domain`, async () => {
  const actual = await vi.importActual<typeof import('@tdsk/domain')>(`@tdsk/domain`)
  return {
    ...actual,
    behindLBProxy: vi.fn(() => false),
  }
})

import { buildProxy } from './buildProxy'
import { behindLBProxy } from '@tdsk/domain'
import { proxyError } from '@TBE/utils/proxy/proxyError'
import { addProxyHeader, addOriginHeader } from '@TBE/utils/proxy/proxyHeaders'

const mockBehindLBProxy = vi.mocked(behindLBProxy)
const mockProxyError = vi.mocked(proxyError)
const mockAddProxyHeader = vi.mocked(addProxyHeader)
const mockAddOriginHeader = vi.mocked(addOriginHeader)

const buildEndpoint = (overrides: Partial<TEndpointConfig> = {}): TEndpointConfig =>
  ({
    path: `/test`,
    method: `proxy`,
    ...overrides,
  }) as unknown as TEndpointConfig

describe(`buildProxy`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockBehindLBProxy.mockReturnValue(false)
  })

  it(`includes pathRewrite when it is a function`, () => {
    const pathRewrite = vi.fn()
    const result = buildProxy(buildEndpoint({ proxy: { pathRewrite } as any }))

    expect(result.pathRewrite).toBe(pathRewrite)
  })

  it(`does not include pathRewrite when it is absent`, () => {
    const result = buildProxy(buildEndpoint())

    expect(result).not.toHaveProperty(`pathRewrite`)
  })

  it(`does not include pathRewrite when it is not a function`, () => {
    const result = buildProxy(
      buildEndpoint({ proxy: { pathRewrite: { foo: `bar` } } as any })
    )

    expect(result).not.toHaveProperty(`pathRewrite`)
  })

  describe(`on.error`, () => {
    it(`calls proxyError`, () => {
      const result = buildProxy(buildEndpoint())
      const err = new Error(`boom`)
      const req = { url: `/test` } as any
      const res = { statusCode: 500 } as any

      result.on!.error!(err, req, res)

      expect(mockProxyError).toHaveBeenCalledWith(err, req, res)
    })

    it(`also calls a custom on.error handler when provided`, () => {
      const customError = vi.fn()
      const result = buildProxy(
        buildEndpoint({ proxy: { on: { error: customError } } as any })
      )
      const err = new Error(`boom`)
      const req = { url: `/test` } as any
      const res = { statusCode: 500 } as any

      result.on!.error!(err, req, res)

      expect(mockProxyError).toHaveBeenCalledWith(err, req, res)
      expect(customError).toHaveBeenCalledWith(err, req, res)
    })

    it(`does not throw when no custom on.error handler is provided`, () => {
      const result = buildProxy(buildEndpoint())

      expect(() =>
        result.on!.error!(new Error(`boom`), {} as any, {} as any)
      ).not.toThrow()
    })
  })

  describe(`on.proxyReq`, () => {
    it(`calls addProxyHeader`, () => {
      const result = buildProxy(buildEndpoint())
      const proxyReq = {} as any
      const req = {} as any
      const res = {} as any
      const options = {} as any

      result.on!.proxyReq!(proxyReq, req, res, options)

      expect(mockAddProxyHeader).toHaveBeenCalledWith(proxyReq, mockConfig)
    })

    it(`also calls a custom on.proxyReq handler when provided`, () => {
      const customProxyReq = vi.fn()
      const result = buildProxy(
        buildEndpoint({ proxy: { on: { proxyReq: customProxyReq } } as any })
      )
      const proxyReq = {} as any
      const req = {} as any
      const res = {} as any
      const options = {} as any

      result.on!.proxyReq!(proxyReq, req, res, options)

      expect(mockAddProxyHeader).toHaveBeenCalledWith(proxyReq, mockConfig)
      expect(customProxyReq).toHaveBeenCalledWith(proxyReq, req, res, options)
    })
  })

  describe(`on.proxyRes`, () => {
    it(`calls addOriginHeader when not behind an LB proxy and originHeader defaults to true`, () => {
      mockBehindLBProxy.mockReturnValue(false)
      const result = buildProxy(buildEndpoint())
      const proxyRes = {} as any
      const req = {} as any
      const res = {} as any

      result.on!.proxyRes!(proxyRes, req, res)

      expect(mockAddOriginHeader).toHaveBeenCalledWith(proxyRes, req, mockConfig)
    })

    it(`does not call addOriginHeader when behind an LB proxy`, () => {
      mockBehindLBProxy.mockReturnValue(true)
      const result = buildProxy(buildEndpoint())
      const proxyRes = {} as any
      const req = {} as any
      const res = {} as any

      result.on!.proxyRes!(proxyRes, req, res)

      expect(mockAddOriginHeader).not.toHaveBeenCalled()
    })

    it(`does not call addOriginHeader when originHeader is explicitly false`, () => {
      mockBehindLBProxy.mockReturnValue(false)
      const result = buildProxy(buildEndpoint({ originHeader: false }))
      const proxyRes = {} as any
      const req = {} as any
      const res = {} as any

      result.on!.proxyRes!(proxyRes, req, res)

      expect(mockAddOriginHeader).not.toHaveBeenCalled()
    })

    it(`always also calls a custom on.proxyRes handler when provided`, () => {
      const customProxyRes = vi.fn()
      mockBehindLBProxy.mockReturnValue(true)
      const result = buildProxy(
        buildEndpoint({ proxy: { on: { proxyRes: customProxyRes } } as any })
      )
      const proxyRes = {} as any
      const req = {} as any
      const res = {} as any

      result.on!.proxyRes!(proxyRes, req, res)

      expect(mockAddOriginHeader).not.toHaveBeenCalled()
      expect(customProxyRes).toHaveBeenCalledWith(proxyRes, req, res)
    })
  })
})

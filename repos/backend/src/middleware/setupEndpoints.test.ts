import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { TApp, TEndpointsConfig } from '@TBE/types'
import type { TRouter, TReqHandler } from '@tdsk/domain'

import { EPMethod } from '@TBE/types'

vi.mock(`@TBE/utils/logger`, () => ({
  logger: {
    error: vi.fn(),
    warn: vi.fn(),
    info: vi.fn(),
  },
}))

/**
 * We use vi.hoisted to create mock references that can be used inside
 * vi.mock factories (which are hoisted above imports by vitest).
 */
const { mockEndpoints, mockChildRouter, mockProxyMiddleware } = vi.hoisted(() => ({
  mockEndpoints: {} as TEndpointsConfig,
  mockChildRouter: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    use: vi.fn(),
    all: vi.fn(),
    patch: vi.fn(),
  },
  mockProxyMiddleware: vi.fn(),
}))

vi.mock(`@TBE/endpoints`, () => ({
  endpoints: mockEndpoints,
}))

vi.mock(`@TBE/server/router`, () => ({
  createAsyncRouter: vi.fn(() => mockChildRouter),
}))

vi.mock(`@TBE/utils/proxy/endpointProxy`, () => ({
  endpointProxy: vi.fn(() => mockProxyMiddleware),
}))

import { setupEndpoints } from './setupEndpoints'

describe(`setupEndpoints`, () => {
  let mockRouter: Record<string, ReturnType<typeof vi.fn>> & TRouter
  let mockApp: TApp

  beforeEach(() => {
    vi.clearAllMocks()

    // Clear any previously injected endpoints
    Object.keys(mockEndpoints).forEach((key) => delete mockEndpoints[key])

    // Reset child router mocks
    Object.values(mockChildRouter).forEach((fn) => fn.mockClear())

    mockRouter = {
      get: vi.fn(),
      post: vi.fn(),
      put: vi.fn(),
      delete: vi.fn(),
      use: vi.fn(),
      all: vi.fn(),
      patch: vi.fn(),
    } as unknown as Record<string, ReturnType<typeof vi.fn>> & TRouter

    mockApp = {
      locals: {
        config: {
          proxy: {
            publicRoutes: [],
          },
        },
      },
    } as unknown as TApp
  })

  it(`should be a function`, () => {
    expect(typeof setupEndpoints).toBe(`function`)
  })

  it(`should register a GET endpoint on the router`, () => {
    const action = vi.fn() as unknown as TReqHandler
    Object.assign(mockEndpoints, {
      testGet: {
        path: `/test`,
        method: EPMethod.Get,
        action,
      },
    })

    setupEndpoints(mockApp, mockRouter as unknown as TRouter)

    expect(mockRouter.get).toHaveBeenCalledWith(`/test`, action)
  })

  it(`should register a POST endpoint on the router`, () => {
    const action = vi.fn() as unknown as TReqHandler
    Object.assign(mockEndpoints, {
      testPost: {
        path: `/items`,
        method: EPMethod.Post,
        action,
      },
    })

    setupEndpoints(mockApp, mockRouter as unknown as TRouter)

    expect(mockRouter.post).toHaveBeenCalledWith(`/items`, action)
  })

  it(`should handle EPMethod.Use endpoints with nested routes`, () => {
    const childAction = vi.fn() as unknown as TReqHandler
    Object.assign(mockEndpoints, {
      parentRoute: {
        path: `/parent`,
        method: EPMethod.Use,
        endpoints: {
          childRoute: {
            path: `/child`,
            method: EPMethod.Get,
            action: childAction,
          },
        },
      },
    })

    setupEndpoints(mockApp, mockRouter as unknown as TRouter)

    // The parent should call router.use with the path and the child router
    expect(mockRouter.use).toHaveBeenCalledWith(`/parent`, expect.anything())

    // The child endpoint should be registered on the child router
    expect(mockChildRouter.get).toHaveBeenCalledWith(`/child`, childAction)
  })

  it(`should skip invalid Use endpoints with no nested endpoints`, () => {
    Object.assign(mockEndpoints, {
      badEndpoint: {
        path: `/bad`,
        method: EPMethod.Use,
        // No 'endpoints' property - isValid returns false for Use without endpoints
      },
    })

    // Should not throw, but should not register any routes
    expect(() => setupEndpoints(mockApp, mockRouter as unknown as TRouter)).not.toThrow()
    expect(mockRouter.use).not.toHaveBeenCalled()
    expect(mockRouter.get).not.toHaveBeenCalled()
  })

  it(`should handle builder function endpoints`, () => {
    const action = vi.fn() as unknown as TReqHandler
    const builder = (app: TApp) => ({
      path: `/dynamic`,
      method: EPMethod.Get,
      action,
    })

    Object.assign(mockEndpoints, {
      dynamicEndpoint: builder,
    })

    setupEndpoints(mockApp, mockRouter as unknown as TRouter)

    expect(mockRouter.get).toHaveBeenCalledWith(`/dynamic`, action)
  })

  it(`should add public routes to config.proxy.publicRoutes`, () => {
    const action = vi.fn() as unknown as TReqHandler
    Object.assign(mockEndpoints, {
      publicRoute: {
        path: `/public`,
        method: EPMethod.Get,
        action,
        public: true,
      },
    })

    setupEndpoints(mockApp, mockRouter as unknown as TRouter)

    expect(mockApp.locals.config.proxy.publicRoutes).toContain(`/public`)
  })

  it(`should include middleware when registering endpoints`, () => {
    const action = vi.fn() as unknown as TReqHandler
    const middleware1 = vi.fn() as unknown as TReqHandler
    const middleware2 = vi.fn() as unknown as TReqHandler

    Object.assign(mockEndpoints, {
      withMiddleware: {
        path: `/guarded`,
        method: EPMethod.Get,
        action,
        middleware: [middleware1, middleware2],
      },
    })

    setupEndpoints(mockApp, mockRouter as unknown as TRouter)

    expect(mockRouter.get).toHaveBeenCalledWith(
      `/guarded`,
      middleware1,
      middleware2,
      action
    )
  })
})

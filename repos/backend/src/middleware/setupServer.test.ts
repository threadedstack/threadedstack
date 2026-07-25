import type { TApp, TRouter } from '@tdsk/domain'
import { setupServer } from './setupServer'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import cors from 'cors'
import helmet from 'helmet'

vi.mock(`cors`, () => ({
  default: vi.fn(() => `cors-middleware`),
}))

vi.mock(`helmet`, () => ({
  default: vi.fn(() => `helmet-middleware`),
}))

describe(`setupServer`, () => {
  let mockSet: ReturnType<typeof vi.fn>
  let mockDisable: ReturnType<typeof vi.fn>
  let mockUse: ReturnType<typeof vi.fn>
  let mockApp: TApp
  let mockRouter: TRouter
  const originalLbProxy = process.env.TDSK_WITH_LB_PROXY

  beforeEach(() => {
    vi.clearAllMocks()
    mockSet = vi.fn()
    mockDisable = vi.fn()
    mockUse = vi.fn()
    mockApp = {
      set: mockSet,
      disable: mockDisable,
      use: mockUse,
      locals: {
        config: {
          server: {
            origins: [`https://example.com`],
          },
        },
      },
    } as unknown as TApp
    mockRouter = {} as TRouter
  })

  afterEach(() => {
    if (originalLbProxy === undefined) delete process.env.TDSK_WITH_LB_PROXY
    else process.env.TDSK_WITH_LB_PROXY = originalLbProxy
  })

  it(`should be a function`, () => {
    expect(typeof setupServer).toBe(`function`)
  })

  it(`configures trust proxy, disables x-powered-by, and applies helmet`, () => {
    delete process.env.TDSK_WITH_LB_PROXY

    setupServer(mockApp, mockRouter)

    expect(mockSet).toHaveBeenCalledWith(`trust proxy`, 1)
    expect(mockDisable).toHaveBeenCalledWith(`x-powered-by`)
    expect(helmet).toHaveBeenCalledOnce()
    expect(mockUse).toHaveBeenCalledWith(`helmet-middleware`)
  })

  it(`applies cors with the explicit origins allowlist when not behind an LB proxy and origins does not include "*"`, () => {
    delete process.env.TDSK_WITH_LB_PROXY
    mockApp.locals.config.server.origins = [`https://example.com`, `https://foo.com`]

    setupServer(mockApp, mockRouter)

    expect(cors).toHaveBeenCalledWith({
      origin: [`https://example.com`, `https://foo.com`],
    })
    expect(mockUse).toHaveBeenCalledWith(`cors-middleware`)
    // helmet + cors + router
    expect(mockUse).toHaveBeenCalledTimes(3)
  })

  it(`applies cors with a wildcard origin when origins includes "*"`, () => {
    delete process.env.TDSK_WITH_LB_PROXY
    mockApp.locals.config.server.origins = [`*`]

    setupServer(mockApp, mockRouter)

    expect(cors).toHaveBeenCalledWith({ origin: `*` })
  })

  it(`does not apply cors when behind an LB proxy`, () => {
    process.env.TDSK_WITH_LB_PROXY = `true`

    setupServer(mockApp, mockRouter)

    expect(cors).not.toHaveBeenCalled()
    // helmet + router only
    expect(mockUse).toHaveBeenCalledTimes(2)
  })

  it(`registers the router last`, () => {
    delete process.env.TDSK_WITH_LB_PROXY

    setupServer(mockApp, mockRouter)

    expect(mockUse).toHaveBeenLastCalledWith(mockRouter)
  })
})

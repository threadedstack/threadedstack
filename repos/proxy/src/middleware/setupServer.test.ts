import type { Router } from 'express'
import type { TProxyApp } from '@TPX/types'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const { mockCorsMiddleware, mockCorsFactory } = vi.hoisted(() => {
  const mockCorsMiddleware = vi.fn()
  return {
    mockCorsMiddleware,
    mockCorsFactory: vi.fn(() => mockCorsMiddleware),
  }
})

vi.mock(`cors`, () => ({
  default: mockCorsFactory,
}))

import { setupServer } from './setupServer'

const buildMockApp = (origins: string[]) =>
  ({
    set: vi.fn(),
    disable: vi.fn(),
    use: vi.fn(),
    locals: {
      config: {
        server: { origins },
      },
    },
  }) as unknown as TProxyApp

const buildMockRouter = () => vi.fn() as unknown as Router

describe(`setupServer`, () => {
  const originalEnv = process.env.TDSK_WITH_LB_PROXY

  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (originalEnv === undefined) delete process.env.TDSK_WITH_LB_PROXY
    else process.env.TDSK_WITH_LB_PROXY = originalEnv
  })

  it(`applies cors with the explicit origins array when TDSK_WITH_LB_PROXY is unset and origins don't include '*'`, () => {
    delete process.env.TDSK_WITH_LB_PROXY
    const app = buildMockApp([`https://a.com`, `https://b.com`])
    const router = buildMockRouter()

    setupServer(app, router)

    expect(mockCorsFactory).toHaveBeenCalledWith({
      origin: [`https://a.com`, `https://b.com`],
    })
    expect(app.use).toHaveBeenCalledWith(mockCorsMiddleware)
  })

  it(`applies cors with wildcard origin when origins include '*'`, () => {
    delete process.env.TDSK_WITH_LB_PROXY
    const app = buildMockApp([`*`])
    const router = buildMockRouter()

    setupServer(app, router)

    expect(mockCorsFactory).toHaveBeenCalledWith({ origin: `*` })
  })

  it(`does not apply cors when TDSK_WITH_LB_PROXY is set (behind an LB proxy)`, () => {
    process.env.TDSK_WITH_LB_PROXY = `true`
    const app = buildMockApp([`https://a.com`])
    const router = buildMockRouter()

    setupServer(app, router)

    expect(mockCorsFactory).not.toHaveBeenCalled()
    expect(app.use).not.toHaveBeenCalledWith(mockCorsMiddleware)
    // helmet + urlencoded + router only -- no extra cors call
    expect(app.use).toHaveBeenCalledTimes(3)
  })

  it(`applies helmet, cors, urlencoded, and router when not behind an LB proxy`, () => {
    delete process.env.TDSK_WITH_LB_PROXY
    const app = buildMockApp([`https://a.com`])
    const router = buildMockRouter()

    setupServer(app, router)

    expect(app.use).toHaveBeenCalledTimes(4)
    expect(app.use).toHaveBeenCalledWith(router)
  })

  it(`sets trust proxy and disables x-powered-by regardless of LB proxy state`, () => {
    delete process.env.TDSK_WITH_LB_PROXY
    const app = buildMockApp([`https://a.com`])
    const router = buildMockRouter()

    setupServer(app, router)

    expect(app.set).toHaveBeenCalledWith(`trust proxy`, 1)
    expect(app.disable).toHaveBeenCalledWith(`x-powered-by`)
  })
})

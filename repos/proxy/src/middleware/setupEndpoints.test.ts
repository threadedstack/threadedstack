import type { Router } from 'express'
import type { TProxyApp } from '@TPX/types'

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const createMockRouter = () =>
  ({
    get: vi.fn(),
    post: vi.fn(),
    all: vi.fn(),
  }) as unknown as Router

describe(`setupEndpoints`, () => {
  const originalNodeEnv = process.env.NODE_ENV

  beforeEach(() => {
    vi.resetModules()
  })

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
  })

  it(`registers the /echo route when not in production`, async () => {
    process.env.NODE_ENV = `test`
    const { setupEndpoints } = await import('./setupEndpoints')
    const router = createMockRouter()

    setupEndpoints({} as TProxyApp, router)

    expect(router.all).toHaveBeenCalledWith(
      `/echo`,
      expect.anything(),
      expect.any(Function)
    )
  })

  it(`does NOT register the /echo route in production`, async () => {
    process.env.NODE_ENV = `production`
    const { setupEndpoints } = await import('./setupEndpoints')
    const router = createMockRouter()

    setupEndpoints({} as TProxyApp, router)

    expect(router.all).not.toHaveBeenCalled()
  })

  it(`always registers the health, auth, and domain validation routes`, async () => {
    process.env.NODE_ENV = `production`
    const { setupEndpoints } = await import('./setupEndpoints')
    const router = createMockRouter()

    setupEndpoints({} as TProxyApp, router)

    expect(router.get).toHaveBeenCalledWith(`/health`, expect.any(Function))
    expect(router.get).toHaveBeenCalledWith(`/auth/me`, expect.any(Function))
    expect(router.post).toHaveBeenCalledWith(`/auth/logout`, expect.any(Function))
    expect(router.get).toHaveBeenCalledWith(`/domains/validate`, expect.any(Function))
  })
})

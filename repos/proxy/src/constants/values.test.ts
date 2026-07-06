import { describe, it, expect, vi, afterEach } from 'vitest'

describe(`PublicRoutes`, () => {
  const originalNodeEnv = process.env.NODE_ENV

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv
    vi.resetModules()
  })

  it(`includes /echo when not in production`, async () => {
    vi.resetModules()
    process.env.NODE_ENV = `test`
    const { PublicRoutes } = await import('./values')

    expect(PublicRoutes).toContain(`/echo`)
  })

  it(`excludes /echo in production`, async () => {
    vi.resetModules()
    process.env.NODE_ENV = `production`
    const { PublicRoutes } = await import('./values')

    expect(PublicRoutes).not.toContain(`/echo`)
  })

  it(`always includes health, domain validation, and payment/subscription routes`, async () => {
    vi.resetModules()
    process.env.NODE_ENV = `production`
    const { PublicRoutes } = await import('./values')

    expect(PublicRoutes).toEqual(
      expect.arrayContaining([
        `/health`,
        `/_/health`,
        `/domains/validate`,
        `/_/payments/webhooks`,
        `/_/subscriptions/plans`,
      ])
    )
  })
})

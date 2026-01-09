import { describe, it, expect, vi, beforeEach } from 'vitest'

describe(`extractToken`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it(`should extract token from valid Authorization header`, async () => {
    const { extractToken } = await import(`./authToken`)
    const req = {
      headers: {
        authorization: `Bearer valid-token-123`,
      },
    } as any

    const token = extractToken(req)
    expect(token).toBe(`valid-token-123`)
  })

  it(`should return null when no Authorization header`, async () => {
    const { extractToken } = await import(`./authToken`)
    const req = {
      headers: {},
    } as any

    const token = extractToken(req)
    expect(token).toBeNull()
  })

  it(`should return null when Authorization header does not start with Bearer`, async () => {
    const { extractToken } = await import(`./authToken`)
    const req = {
      headers: {
        authorization: `Basic some-credentials`,
      },
    } as any

    const token = extractToken(req)
    expect(token).toBeNull()
  })

  it(`should return null when Authorization header is empty`, async () => {
    const { extractToken } = await import(`./authToken`)
    const req = {
      headers: {
        authorization: ``,
      },
    } as any

    const token = extractToken(req)
    expect(token).toBeNull()
  })
})

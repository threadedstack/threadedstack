import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { status } from './status'

describe(`status`, () => {
  let mockAuth: { creds: ReturnType<typeof vi.fn>; isExpired: ReturnType<typeof vi.fn> }
  let output: string[]

  beforeEach(() => {
    vi.clearAllMocks()
    mockAuth = { creds: vi.fn(), isExpired: vi.fn() }
    output = []
    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(chunk.toString())
      return true
    })
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  const joined = () => output.join(``)

  it(`shows not-logged-in and omits Proxy when creds() is falsy`, async () => {
    mockAuth.creds.mockReturnValue(null)

    await status.action!({ auth: mockAuth } as any)

    expect(joined()).toContain(`not logged in`)
    expect(joined()).not.toContain(`Proxy:`)
  })

  it(`masks the API key when creds.apiKey is set`, async () => {
    mockAuth.creds.mockReturnValue({
      proxyUrl: `https://px.local.threadedstack.app`,
      apiKey: `tdsk_abcdef1234567890`,
    })

    await status.action!({ auth: mockAuth } as any)

    expect(joined()).toContain(`API key (tdsk_abc********)`)
    expect(mockAuth.isExpired).not.toHaveBeenCalled()
  })

  it(`shows an "expires in N min" suffix when token is present, not expired, with an expiresAt`, async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(`2026-01-01T00:00:00.000Z`))
    mockAuth.creds.mockReturnValue({
      proxyUrl: `https://px.local.threadedstack.app`,
      token: `tok-1`,
      expiresAt: new Date(`2026-01-01T00:10:00.000Z`).getTime(),
    })
    mockAuth.isExpired.mockReturnValue(false)

    await status.action!({ auth: mockAuth } as any)

    expect(joined()).toContain(`Browser session`)
    expect(joined()).toContain(`(expires in 10 min)`)
  })

  it(`shows "(expired)" instead of expires-in when isExpired() is true`, async () => {
    mockAuth.creds.mockReturnValue({
      proxyUrl: `https://px.local.threadedstack.app`,
      token: `tok-1`,
      expiresAt: Date.now() + 60_000,
    })
    mockAuth.isExpired.mockReturnValue(true)

    await status.action!({ auth: mockAuth } as any)

    expect(joined()).toContain(`(expired)`)
    expect(joined()).not.toContain(`expires in`)
  })

  it(`shows Browser session with no suffix when expiresAt is falsy`, async () => {
    mockAuth.creds.mockReturnValue({
      proxyUrl: `https://px.local.threadedstack.app`,
      token: `tok-1`,
      expiresAt: undefined,
    })
    mockAuth.isExpired.mockReturnValue(false)

    await status.action!({ auth: mockAuth } as any)

    expect(joined()).toContain(`Browser session`)
    expect(joined()).not.toContain(`expires in`)
    expect(joined()).not.toContain(`expired`)
  })

  it(`omits the Auth line entirely when creds has neither apiKey nor token`, async () => {
    mockAuth.creds.mockReturnValue({
      proxyUrl: `https://px.local.threadedstack.app`,
    })

    await status.action!({ auth: mockAuth } as any)

    expect(joined()).toContain(`logged in`)
    expect(joined()).toContain(`Proxy:`)
    expect(joined()).not.toContain(`Auth:`)
  })
})

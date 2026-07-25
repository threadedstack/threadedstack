import type { TSlashCommandContext } from '@TSA/types'

import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockBrowserLogin = vi.fn()
const mockResolveAuthUrl = vi.fn()
const mockResolveProxyUrl = vi.fn()

vi.mock(`@TSA/services/browserAuth`, () => ({
  browserLogin: (...args: any[]) => mockBrowserLogin(...args),
}))

vi.mock(`@TSA/utils/tasks/resolveUrls`, () => ({
  resolveAuthUrl: (...args: any[]) => mockResolveAuthUrl(...args),
  resolveProxyUrl: (...args: any[]) => mockResolveProxyUrl(...args),
}))

import { loginCommand } from './login'

const makeCtx = (overrides: Partial<TSlashCommandContext> = {}): TSlashCommandContext =>
  ({
    output: vi.fn(),
    auth: {
      loggedIn: false,
      proxyUrl: undefined,
      logout: vi.fn(),
      login: vi.fn().mockResolvedValue(undefined),
      loginWithToken: vi.fn().mockResolvedValue(undefined),
    },
    ...overrides,
  }) as unknown as TSlashCommandContext

describe(`/login command`, () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockResolveProxyUrl.mockReturnValue(`https://px.local.threadedstack.app`)
  })

  it(`writes an invalid-URL error and a hint, and does not attempt browser login, when the resolved auth URL is invalid`, async () => {
    mockResolveAuthUrl.mockReturnValue(``)
    const ctx = makeCtx()

    await loginCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(
      expect.stringContaining(`Error: Invalid auth URL`)
    )
    expect(ctx.output).toHaveBeenCalledWith(
      expect.stringContaining(`Check your TDSK_AUTH_URL or config auth URL.`)
    )
    expect(mockBrowserLogin).not.toHaveBeenCalled()
  })

  it(`runs the opening/validating/success sequence and calls loginWithToken with the browser result plus proxyUrl`, async () => {
    mockResolveAuthUrl.mockReturnValue(`https://auth.local.threadedstack.app`)
    mockBrowserLogin.mockResolvedValue({ token: `t-1` })
    const ctx = makeCtx()

    await loginCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`Opening browser for authentication...`)
    expect(ctx.output).toHaveBeenCalledWith(`Validating session...`)
    expect(ctx.output).toHaveBeenCalledWith(`Logged in successfully.`)
    expect(ctx.auth.loginWithToken).toHaveBeenCalledWith({
      token: `t-1`,
      proxyUrl: `https://px.local.threadedstack.app`,
    })
  })

  it(`writes the error message and the /login <api-key> hint when browserLogin rejects with an Error`, async () => {
    mockResolveAuthUrl.mockReturnValue(`https://auth.local.threadedstack.app`)
    mockBrowserLogin.mockRejectedValue(new Error(`network unreachable`))
    const ctx = makeCtx()

    await loginCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`Error: network unreachable`)
    expect(ctx.output).toHaveBeenCalledWith(
      expect.stringContaining(`Try /login <api-key> for API key auth`)
    )
  })

  it(`falls back to "Browser login failed" when loginWithToken rejects with a non-Error`, async () => {
    mockResolveAuthUrl.mockReturnValue(`https://auth.local.threadedstack.app`)
    mockBrowserLogin.mockResolvedValue({ token: `t-1` })
    const ctx = makeCtx()
    ;(ctx.auth.loginWithToken as ReturnType<typeof vi.fn>).mockRejectedValue(
      `some string error`
    )

    await loginCommand.handler(``, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`Error: Browser login failed`)
  })

  it(`calls ctx.auth.login with the api key and proxyUrl when only an api key is passed`, async () => {
    const ctx = makeCtx()

    await loginCommand.handler(`my-api-key`, ctx)

    expect(ctx.auth.login).toHaveBeenCalledWith(
      `my-api-key`,
      `https://px.local.threadedstack.app`,
      false
    )
    expect(ctx.output).toHaveBeenCalledWith(`Logged in successfully.`)
  })

  it(`sets insecure=true when --insecure is present`, async () => {
    const ctx = makeCtx()

    await loginCommand.handler(`my-api-key --insecure`, ctx)

    expect(ctx.auth.login).toHaveBeenCalledWith(
      `my-api-key`,
      `https://px.local.threadedstack.app`,
      true
    )
  })

  it(`uses the --url value as customUrl instead of proxyUrl`, async () => {
    const ctx = makeCtx()

    await loginCommand.handler(`my-api-key --url https://custom.example.com`, ctx)

    expect(ctx.auth.login).toHaveBeenCalledWith(
      `my-api-key`,
      `https://custom.example.com`,
      false
    )
  })

  it(`writes a single error message with no second hint when ctx.auth.login rejects with an Error`, async () => {
    const ctx = makeCtx()
    ;(ctx.auth.login as ReturnType<typeof vi.fn>).mockRejectedValue(new Error(`bad key`))

    await loginCommand.handler(`my-api-key`, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`Error: bad key`)
    expect(ctx.output).not.toHaveBeenCalledWith(expect.stringContaining(`Try /login`))
  })

  it(`falls back to "Login failed" when ctx.auth.login rejects with a non-Error`, async () => {
    const ctx = makeCtx()
    ;(ctx.auth.login as ReturnType<typeof vi.fn>).mockRejectedValue(`some string error`)

    await loginCommand.handler(`my-api-key`, ctx)

    expect(ctx.output).toHaveBeenCalledWith(`Error: Login failed`)
  })
})

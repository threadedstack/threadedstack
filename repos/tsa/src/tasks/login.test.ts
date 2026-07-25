import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockBrowserLogin = vi.fn()
const mockResolveOrgId = vi.fn()
const mockResolveAuthUrl = vi.fn()
const mockResolveProxyUrl = vi.fn()
const mockCreateCliSessionKey = vi.fn()
const mockUpdateKey = vi.fn()

vi.mock(`@TSA/services/api`, () => ({
  ApiClient: vi.fn().mockImplementation(() => ({
    createCliSessionKey: (...args: any[]) => mockCreateCliSessionKey(...args),
  })),
}))

vi.mock(`@TSA/services/config`, () => ({
  ConfigService: {
    updateKey: (...args: any[]) => mockUpdateKey(...args),
  },
}))

vi.mock(`@TSA/services/browserAuth`, () => ({
  browserLogin: (...args: any[]) => mockBrowserLogin(...args),
}))

vi.mock(`@TSA/utils/tasks/resolveOrgId`, () => ({
  resolveOrgId: (...args: any[]) => mockResolveOrgId(...args),
}))

vi.mock(`@TSA/utils/tasks/resolveUrls`, () => ({
  resolveAuthUrl: (...args: any[]) => mockResolveAuthUrl(...args),
  resolveProxyUrl: (...args: any[]) => mockResolveProxyUrl(...args),
}))

import { login } from './login'

describe(`login task`, () => {
  let output: string[]
  let errOutput: string[]
  let exitCode: number | undefined

  const written = () => output.join(``)
  const errWritten = () => errOutput.join(``)

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NO_COLOR = `1`
    output = []
    errOutput = []
    exitCode = undefined

    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(String(chunk))
      return true
    })
    vi.spyOn(process.stderr, `write`).mockImplementation((chunk: any) => {
      errOutput.push(String(chunk))
      return true
    })
    vi.spyOn(process, `exit`).mockImplementation((code?: any) => {
      exitCode = code
      throw new Error(`__EXIT__`)
    })

    mockResolveProxyUrl.mockReturnValue(`https://px.local.threadedstack.app`)
    mockResolveAuthUrl.mockReturnValue(`https://auth.local.threadedstack.app`)
    mockBrowserLogin.mockResolvedValue({ token: `t-1` })
    mockResolveOrgId.mockResolvedValue(`org-1`)
    mockCreateCliSessionKey.mockResolvedValue({
      ok: true,
      data: { key: `session-key`, id: `key-id` },
    })
  })

  afterEach(() => {
    delete process.env.NO_COLOR
  })

  const makeAuth = (overrides: Record<string, any> = {}) => ({
    login: vi.fn().mockResolvedValue(undefined),
    loginWithToken: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  })

  it(`apiKey provided, auth.login resolves -- writes success, never touches the browser path`, async () => {
    const auth = makeAuth()

    await login.action!({
      params: { apiKey: `my-key` },
      auth,
      options: [],
      config: {},
    } as any)

    expect(auth.login).toHaveBeenCalledWith(
      `my-key`,
      `https://px.local.threadedstack.app`,
      false
    )
    expect(written()).toContain(`Logged in successfully`)
    expect(mockResolveAuthUrl).not.toHaveBeenCalled()
    expect(mockBrowserLogin).not.toHaveBeenCalled()
  })

  it(`apiKey provided, auth.login rejects with an Error -- writes the error, exits 1, returns before the browser path`, async () => {
    const auth = makeAuth({ login: vi.fn().mockRejectedValue(new Error(`bad key`)) })

    await expect(
      login.action!({
        params: { apiKey: `my-key` },
        auth,
        options: [],
        config: {},
      } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(written()).toContain(`Error:`)
    expect(written()).toContain(`bad key`)
    expect(mockBrowserLogin).not.toHaveBeenCalled()
  })

  it(`no apiKey, invalid auth URL -- writes an invalid-URL error and exits 1 before opening the browser`, async () => {
    mockResolveAuthUrl.mockReturnValue(``)
    const auth = makeAuth()

    await expect(
      login.action!({ params: {}, auth, options: [], config: {} } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(written()).toContain(`Invalid auth URL`)
    expect(mockBrowserLogin).not.toHaveBeenCalled()
  })

  it(`no apiKey, full happy path with session-key creation succeeding -- success message omits the short-lived-token suffix`, async () => {
    const auth = makeAuth()

    await login.action!({ params: {}, auth, options: [], config: {} } as any)

    expect(written()).toContain(`Logged in successfully`)
    expect(written()).not.toContain(`short-lived token`)
    expect(auth.login).toHaveBeenCalledWith(
      `session-key`,
      `https://px.local.threadedstack.app`,
      false,
      `key-id`
    )
    expect(mockUpdateKey).toHaveBeenCalledWith(`org`, `org-1`)
  })

  it(`no apiKey, session-key creation returns ok:false -- warns to stderr, still succeeds with the short-lived-token suffix`, async () => {
    mockCreateCliSessionKey.mockResolvedValue({
      ok: false,
      status: 500,
      error: { message: `server exploded` },
    })
    const auth = makeAuth()

    await login.action!({ params: {}, auth, options: [], config: {} } as any)

    expect(errWritten()).toContain(`Warning`)
    expect(written()).toContain(`Logged in successfully`)
    expect(written()).toContain(`short-lived token`)
    expect(mockUpdateKey).toHaveBeenCalledWith(`org`, `org-1`)
  })

  it(`no apiKey, session-key resolution throws -- warns to stderr, still succeeds with the short-lived-token suffix, but ConfigService.updateKey is NOT reached (it sits after the throwing calls in the same try block)`, async () => {
    mockResolveOrgId.mockRejectedValue(new Error(`org lookup failed`))
    const auth = makeAuth()

    await login.action!({ params: {}, auth, options: [], config: {} } as any)

    expect(errWritten()).toContain(`Warning`)
    expect(written()).toContain(`Logged in successfully`)
    expect(written()).toContain(`short-lived token`)
    expect(mockUpdateKey).not.toHaveBeenCalled()
  })

  it(`no apiKey, browserLogin itself rejects -- writes the error, exits 1, never reaches session-key creation`, async () => {
    mockBrowserLogin.mockRejectedValue(new Error(`network unreachable`))
    const auth = makeAuth()

    await expect(
      login.action!({ params: {}, auth, options: [], config: {} } as any)
    ).rejects.toThrow(`__EXIT__`)

    expect(exitCode).toBe(1)
    expect(written()).toContain(`Error:`)
    expect(written()).toContain(`network unreachable`)
    expect(mockUpdateKey).not.toHaveBeenCalled()
  })
})

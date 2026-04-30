import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockLoadGlobal = vi.fn()
const mockSaveGlobal = vi.fn()

vi.mock(`@TSA/services/config`, () => ({
  ConfigService: {
    loadGlobal: (...args: any[]) => mockLoadGlobal(...args),
    saveGlobal: (...args: any[]) => mockSaveGlobal(...args),
  },
}))

const mockBrowserLogin = vi.fn()
vi.mock(`@TSA/services/browserAuth`, () => ({
  browserLogin: (...args: any[]) => mockBrowserLogin(...args),
}))

const mockMaybeRefresh = vi.fn()
vi.mock(`@TSA/services/tokenRefresh`, () => ({
  TokenRefreshService: vi.fn().mockImplementation(() => ({
    maybeRefresh: (...args: any[]) => mockMaybeRefresh(...args),
  })),
}))

const mockFetch = vi.fn()
vi.stubGlobal(`fetch`, mockFetch)

import { ensureAuth } from './ensureAuth'

const makeAction = () => vi.fn().mockResolvedValue(`action-result`)

const makeAuth = (overrides?: { loggedIn?: boolean; isExpired?: boolean }) => ({
  loggedIn: vi.fn().mockReturnValue(overrides?.loggedIn ?? true),
  isExpired: vi.fn().mockReturnValue(overrides?.isExpired ?? false),
  creds: vi.fn().mockReturnValue({ token: `jwt_test`, proxyUrl: `https://proxy.test` }),
  login: vi.fn(),
  loginWithToken: vi.fn().mockResolvedValue(undefined),
  logout: vi.fn(),
  bearer: `jwt_test`,
})

const makeArgs = (authOverrides?: { loggedIn?: boolean; isExpired?: boolean }) => ({
  params: {},
  task: { name: `test` } as any,
  tasks: {} as any,
  auth: makeAuth(authOverrides),
  config: undefined,
  options: [],
})

describe(`ensureAuth`, () => {
  let output: string[]
  let exitCode: number | undefined
  const originalIsTTY = process.stdin.isTTY

  beforeEach(() => {
    vi.clearAllMocks()
    output = []
    exitCode = undefined

    vi.spyOn(process.stdout, `write`).mockImplementation((chunk: any) => {
      output.push(String(chunk))
      return true
    })
    vi.spyOn(process, `exit`).mockImplementation((code?: any) => {
      exitCode = code ?? 0
      throw new Error(`__EXIT__`)
    })
    vi.spyOn(process.stderr, `write`).mockImplementation(() => true)

    mockLoadGlobal.mockReturnValue({})
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })
  })

  afterEach(() => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value: originalIsTTY,
      writable: true,
      configurable: true,
    })
  })

  const setTTY = (value: boolean | undefined) => {
    Object.defineProperty(process.stdin, `isTTY`, {
      value,
      writable: true,
      configurable: true,
    })
  }

  const runWrapped = async (action = makeAction(), args = makeArgs()) => {
    try {
      const result = await ensureAuth(action)(args as any)
      return { result, action }
    } catch (err: any) {
      if (err.message !== `__EXIT__`) throw err
      return { result: undefined, action }
    }
  }

  const joined = () => output.join(``)

  describe(`when logged in and not expired`, () => {
    it(`calls the wrapped action and returns its result`, async () => {
      const action = makeAction()
      const args = makeArgs({ loggedIn: true, isExpired: false })
      const { result } = await runWrapped(action, args)

      expect(action).toHaveBeenCalledTimes(1)
      expect(action).toHaveBeenCalledWith(args)
      expect(result).toBe(`action-result`)
      expect(exitCode).toBeUndefined()
    })

    it(`does not attempt browser login`, async () => {
      await runWrapped(makeAction(), makeArgs({ loggedIn: true, isExpired: false }))
      expect(mockBrowserLogin).not.toHaveBeenCalled()
    })
  })

  describe(`when logged in but token is expired`, () => {
    it(`attempts token refresh and proceeds if refresh succeeds`, async () => {
      mockMaybeRefresh.mockResolvedValue(true)

      const action = makeAction()
      const auth = makeAuth({ loggedIn: true, isExpired: true })
      // isExpired call sequence:
      //   call 1: first guard  `auth.loggedIn() && !auth.isExpired()` → true (not expired-yet path skipped)
      //   call 2: second guard `auth.loggedIn() && auth.isExpired()`  → true (enter expired branch)
      //   call 3: post-refresh `auth.loggedIn() && !auth.isExpired()` → false (token now fresh)
      auth.isExpired
        .mockReturnValueOnce(true) // call 1 — first guard fails (token is expired)
        .mockReturnValueOnce(true) // call 2 — second guard succeeds (enter refresh branch)
        .mockReturnValue(false) // call 3+ — after refresh token is fresh

      const args = {
        params: {},
        task: { name: `test` } as any,
        tasks: {} as any,
        auth,
        config: undefined,
        options: [],
      }
      const { result } = await runWrapped(action, args)

      expect(mockMaybeRefresh).toHaveBeenCalledTimes(1)
      expect(action).toHaveBeenCalledTimes(1)
      expect(result).toBe(`action-result`)
      expect(exitCode).toBeUndefined()
    })

    it(`falls through to browser login if refresh fails and TTY is available`, async () => {
      setTTY(true)
      mockMaybeRefresh.mockResolvedValue(false)
      mockBrowserLogin.mockResolvedValue({
        token: `new_jwt`,
        expiresAt: `2099-01-01T00:00:00Z`,
      })
      mockLoadGlobal.mockReturnValue({})

      const action = makeAction()
      const auth = makeAuth({ loggedIn: true, isExpired: true })
      // After "refresh" loggedIn still returns true but isExpired still true → browser login path
      auth.isExpired.mockReturnValue(true)

      const args = {
        params: {},
        task: { name: `test` } as any,
        tasks: {} as any,
        auth,
        config: undefined,
        options: [],
      }
      await runWrapped(action, args)

      expect(mockBrowserLogin).toHaveBeenCalledTimes(1)
      expect(joined()).toContain(`Opening browser`)
    })
  })

  describe(`when not logged in and not a TTY`, () => {
    it(`writes an error message and exits with code 1`, async () => {
      setTTY(undefined) // non-TTY: isTTY is falsy

      const action = makeAction()
      const args = makeArgs({ loggedIn: false, isExpired: false })
      await runWrapped(action, args)

      expect(exitCode).toBe(1)
      expect(joined()).toContain(`Not logged in.`)
      expect(joined()).toContain(`tsa login`)
      expect(action).not.toHaveBeenCalled()
      expect(mockBrowserLogin).not.toHaveBeenCalled()
    })

    it(`does not attempt browser login in non-TTY mode`, async () => {
      setTTY(false)
      const args = makeArgs({ loggedIn: false })
      await runWrapped(makeAction(), args)

      expect(mockBrowserLogin).not.toHaveBeenCalled()
    })
  })

  describe(`when not logged in and in a TTY`, () => {
    it(`opens browser login and calls the action on success`, async () => {
      setTTY(true)
      mockBrowserLogin.mockResolvedValue({
        token: `browser_jwt`,
        expiresAt: `2099-01-01T00:00:00Z`,
      })
      mockLoadGlobal.mockReturnValue({})

      const action = makeAction()
      const args = makeArgs({ loggedIn: false })
      await runWrapped(action, args)

      expect(mockBrowserLogin).toHaveBeenCalledTimes(1)
      expect(joined()).toContain(`Opening browser`)
      expect(joined()).toContain(`Logged in successfully`)
      expect(action).toHaveBeenCalledTimes(1)
      expect(exitCode).toBeUndefined()
    })

    it(`calls auth.loginWithToken with browser result`, async () => {
      setTTY(true)
      const browserResult = {
        token: `browser_jwt`,
        expiresAt: `2099-01-01T00:00:00Z`,
        neonAuthUrl: `https://auth.example.com`,
      }
      mockBrowserLogin.mockResolvedValue(browserResult)
      mockLoadGlobal.mockReturnValue({})

      const action = makeAction()
      const args = makeArgs({ loggedIn: false })
      await runWrapped(action, args)

      expect(args.auth.loginWithToken).toHaveBeenCalledWith(
        expect.objectContaining({
          token: `browser_jwt`,
          expiresAt: `2099-01-01T00:00:00Z`,
        })
      )
    })
  })

  describe(`when browser login fails`, () => {
    it(`writes an error message and exits with code 1`, async () => {
      setTTY(true)
      mockBrowserLogin.mockRejectedValue(
        new Error(`Authentication timed out after 5 minutes.`)
      )

      const action = makeAction()
      const args = makeArgs({ loggedIn: false })
      await runWrapped(action, args)

      expect(exitCode).toBe(1)
      expect(joined()).toContain(`Error:`)
      expect(joined()).toContain(`Authentication timed out`)
      expect(action).not.toHaveBeenCalled()
    })

    it(`uses a fallback message when the error is not an Error instance`, async () => {
      setTTY(true)
      mockBrowserLogin.mockRejectedValue(`string error`)

      const args = makeArgs({ loggedIn: false })
      await runWrapped(makeAction(), args)

      expect(exitCode).toBe(1)
      expect(joined()).toContain(`Browser login failed`)
    })
  })
})

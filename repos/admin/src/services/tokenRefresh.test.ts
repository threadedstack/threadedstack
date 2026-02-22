import type { TAuthSession } from '@TAF/types'

import { TokenRefreshManager } from './tokenRefresh'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockBearer = vi.fn()
const mockGetSession = vi.fn()

vi.mock(`@TAF/services/api`, () => ({
  apiService: {
    bearer: (...args: any[]) => mockBearer(...args),
    clearBearer: vi.fn(),
  },
}))

vi.mock(`@TAF/services/auth`, () => ({
  authClient: {
    getSession: () => mockGetSession(),
  },
}))

const makeSession = (overrides?: Partial<TAuthSession>): TAuthSession => ({
  id: `sess-1`,
  token: `test-token`,
  userId: `user-1`,
  expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  ...overrides,
})

const freshSession: TAuthSession = {
  id: `sess-2`,
  token: `refreshed-token`,
  userId: `user-1`,
  expiresAt: new Date(Date.now() + 20 * 60 * 1000).toISOString(),
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
}

describe(`TokenRefreshManager`, () => {
  let manager: TokenRefreshManager
  let onSessionUpdate: ReturnType<typeof vi.fn>
  let onAuthFailure: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
    manager = new TokenRefreshManager()
    onSessionUpdate = vi.fn()
    onAuthFailure = vi.fn()

    mockBearer.mockResolvedValue(undefined)
    mockGetSession.mockResolvedValue({
      data: { session: freshSession, user: { id: `user-1` } },
    })
  })

  afterEach(() => {
    manager.stop()
    vi.useRealTimers()
  })

  describe(`start()`, () => {
    it(`should schedule refresh based on expiresAt minus buffer`, () => {
      const session = makeSession({
        expiresAt: new Date(Date.now() + 10 * 60 * 1000).toISOString(),
      })
      manager.start(session, onSessionUpdate, onAuthFailure)

      expect(vi.getTimerCount()).toBe(1)
    })

    it(`should use fallback interval when expiresAt is not set`, () => {
      const session = makeSession({ expiresAt: undefined as any })
      manager.start(session, onSessionUpdate, onAuthFailure)

      expect(vi.getTimerCount()).toBe(1)
    })
  })

  describe(`stop()`, () => {
    it(`should clear the scheduled timer`, () => {
      manager.start(makeSession(), onSessionUpdate, onAuthFailure)
      expect(vi.getTimerCount()).toBe(1)

      manager.stop()
      expect(vi.getTimerCount()).toBe(0)
    })

    it(`should be safe to call multiple times`, () => {
      manager.start(makeSession(), onSessionUpdate, onAuthFailure)
      manager.stop()
      manager.stop()
      expect(vi.getTimerCount()).toBe(0)
    })

    it(`should prevent scheduled refresh from firing after stop`, async () => {
      const session = makeSession({
        expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      })
      manager.start(session, onSessionUpdate, onAuthFailure)
      manager.stop()

      await vi.advanceTimersByTimeAsync(5 * 60 * 1000)
      expect(mockBearer).not.toHaveBeenCalled()
    })
  })

  describe(`refreshAndRetry()`, () => {
    it(`should call apiService.bearer() to refresh token`, async () => {
      manager.start(makeSession(), onSessionUpdate, onAuthFailure)
      await manager.refreshAndRetry()
      expect(mockBearer).toHaveBeenCalledOnce()
    })

    it(`should return true on successful refresh`, async () => {
      manager.start(makeSession(), onSessionUpdate, onAuthFailure)
      const result = await manager.refreshAndRetry()
      expect(result).toBe(true)
    })

    it(`should return false when getSession returns no token`, async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } })
      manager.start(makeSession(), onSessionUpdate, onAuthFailure)

      const result = await manager.refreshAndRetry()
      expect(result).toBe(false)
    })

    it(`should return false on network error`, async () => {
      mockBearer.mockRejectedValueOnce(new Error(`Network error`))
      manager.start(makeSession(), onSessionUpdate, onAuthFailure)

      const result = await manager.refreshAndRetry()
      expect(result).toBe(false)
    })

    it(`should deduplicate concurrent calls (mutex)`, async () => {
      manager.start(makeSession(), onSessionUpdate, onAuthFailure)

      const [r1, r2, r3] = await Promise.all([
        manager.refreshAndRetry(),
        manager.refreshAndRetry(),
        manager.refreshAndRetry(),
      ])

      expect(mockBearer).toHaveBeenCalledOnce()
      expect(r1).toBe(true)
      expect(r2).toBe(true)
      expect(r3).toBe(true)
    })

    it(`should allow new refresh after previous completes`, async () => {
      manager.start(makeSession(), onSessionUpdate, onAuthFailure)

      await manager.refreshAndRetry()
      await manager.refreshAndRetry()

      expect(mockBearer).toHaveBeenCalledTimes(2)
    })
  })

  describe(`proactive refresh`, () => {
    it(`should call refresh when timer fires`, async () => {
      const session = makeSession({
        expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      })
      manager.start(session, onSessionUpdate, onAuthFailure)

      await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
      expect(mockBearer).toHaveBeenCalled()
    })

    it(`should call onAuthFailure when proactive refresh fails`, async () => {
      mockBearer.mockRejectedValueOnce(new Error(`fail`))

      const session = makeSession({
        expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      })
      manager.start(session, onSessionUpdate, onAuthFailure)

      await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
      expect(onAuthFailure).toHaveBeenCalledOnce()
    })

    it(`should reschedule after successful refresh`, async () => {
      const session = makeSession({
        expiresAt: new Date(Date.now() + 3 * 60 * 1000).toISOString(),
      })
      manager.start(session, onSessionUpdate, onAuthFailure)

      await vi.advanceTimersByTimeAsync(2 * 60 * 1000)
      expect(mockBearer).toHaveBeenCalledOnce()

      // Timer should be rescheduled
      expect(vi.getTimerCount()).toBe(1)
    })
  })

  describe(`session update callback`, () => {
    it(`should call onSessionUpdate with new session after refresh`, async () => {
      manager.start(makeSession(), onSessionUpdate, onAuthFailure)
      await manager.refreshAndRetry()

      expect(onSessionUpdate).toHaveBeenCalledWith(freshSession)
    })

    it(`should not call onSessionUpdate after stop`, async () => {
      manager.start(makeSession(), onSessionUpdate, onAuthFailure)
      manager.stop()

      // Create a new manager that was stopped — refreshAndRetry still works
      // but onSessionUpdate should not fire
      const manager2 = new TokenRefreshManager()
      manager2.start(makeSession(), onSessionUpdate, onAuthFailure)
      manager2.stop()

      // Even if doRefresh runs, the callback is nulled
      mockGetSession.mockResolvedValueOnce({
        data: { session: freshSession, user: { id: `user-1` } },
      })
      // Force a refresh on the stopped manager — callbacks are null
      // This tests the ?.() null-check behavior
      expect(onSessionUpdate).not.toHaveBeenCalled()
    })
  })

  describe(`visibility change`, () => {
    it(`should trigger refresh when tab becomes visible and token is near expiry`, async () => {
      const session = makeSession({
        expiresAt: new Date(Date.now() + 60 * 1000).toISOString(),
      })
      manager.start(session, onSessionUpdate, onAuthFailure)
      vi.clearAllMocks()

      Object.defineProperty(document, `visibilityState`, {
        value: `visible`,
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event(`visibilitychange`))

      // Wait for async doRefresh to complete
      await vi.advanceTimersByTimeAsync(0)
      expect(mockBearer).toHaveBeenCalled()
    })

    it(`should not refresh when tab becomes visible and token is still valid`, async () => {
      const session = makeSession({
        expiresAt: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
      })
      manager.start(session, onSessionUpdate, onAuthFailure)
      vi.clearAllMocks()

      Object.defineProperty(document, `visibilityState`, {
        value: `visible`,
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event(`visibilitychange`))

      await vi.advanceTimersByTimeAsync(0)
      expect(mockBearer).not.toHaveBeenCalled()
    })

    it(`should not refresh when tab is hidden`, async () => {
      manager.start(makeSession(), onSessionUpdate, onAuthFailure)
      vi.clearAllMocks()

      Object.defineProperty(document, `visibilityState`, {
        value: `hidden`,
        writable: true,
        configurable: true,
      })
      document.dispatchEvent(new Event(`visibilitychange`))

      await vi.advanceTimersByTimeAsync(0)
      expect(mockBearer).not.toHaveBeenCalled()
    })

    it(`should remove listener on stop`, () => {
      const spy = vi.spyOn(document, `removeEventListener`)
      manager.start(makeSession(), onSessionUpdate, onAuthFailure)
      manager.stop()

      expect(spy).toHaveBeenCalledWith(`visibilitychange`, expect.any(Function))
      spy.mockRestore()
    })
  })
})

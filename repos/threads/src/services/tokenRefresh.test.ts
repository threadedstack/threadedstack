import type { TAuthSession } from '@tdsk/components'

import {
  RefreshBufferMS,
  MinCheckIntervalMS,
  FallbackCheckIntervalMS,
} from '@tdsk/components'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

const mockBearer = vi.fn()
const mockGetSession = vi.fn()

vi.mock(`@TTH/services/api`, () => ({
  apiService: {
    bearer: (...args: any[]) => mockBearer(...args),
  },
}))

vi.mock(`@TTH/services/auth`, () => ({
  authClient: {
    getSession: (...args: any[]) => mockGetSession(...args),
  },
}))

import { TokenRefreshManager } from './tokenRefresh'

const NOW = new Date(`2030-01-01T00:00:00.000Z`).getTime()

const baseSession: TAuthSession = {
  id: `sess-1`,
  token: `tok-1`,
  userId: `u-1`,
  expiresAt: new Date(NOW + 5 * 60 * 1000).toISOString(),
  createdAt: new Date(NOW).toISOString(),
  updatedAt: new Date(NOW).toISOString(),
}

describe(`TokenRefreshManager`, () => {
  let addEventListenerSpy: ReturnType<typeof vi.spyOn>
  let removeEventListenerSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(NOW)

    mockBearer.mockResolvedValue(undefined)
    mockGetSession.mockResolvedValue({
      data: { session: baseSession, user: { id: `u-1` } },
    })

    addEventListenerSpy = vi.spyOn(document, `addEventListener`)
    removeEventListenerSpy = vi.spyOn(document, `removeEventListener`)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  const getVisibilityHandler = () => {
    const call = addEventListenerSpy.mock.calls.find((c) => c[0] === `visibilitychange`)
    return call?.[1] as () => void
  }

  const setVisibility = (state: `visible` | `hidden`) => {
    Object.defineProperty(document, `visibilityState`, {
      value: state,
      configurable: true,
    })
  }

  describe(`start() / stop()`, () => {
    it(`schedules a timer and registers the visibilitychange listener`, () => {
      const manager = new TokenRefreshManager()

      manager.start(baseSession, vi.fn(), vi.fn())

      expect(vi.getTimerCount()).toBe(1)
      expect(addEventListenerSpy).toHaveBeenCalledWith(
        `visibilitychange`,
        expect.any(Function)
      )
    })

    it(`clears the timer and unregisters the listener`, () => {
      const manager = new TokenRefreshManager()

      manager.start(baseSession, vi.fn(), vi.fn())
      const handler = getVisibilityHandler()
      manager.stop()

      expect(vi.getTimerCount()).toBe(0)
      expect(removeEventListenerSpy).toHaveBeenCalledWith(`visibilitychange`, handler)
    })
  })

  describe(`refreshAndRetry() dedup`, () => {
    it(`concurrent calls while a refresh is in flight resolve together off a single underlying refresh`, async () => {
      let resolveSession: (v: any) => void = () => {}
      mockGetSession.mockReturnValueOnce(
        new Promise((resolve) => {
          resolveSession = resolve
        })
      )

      const manager = new TokenRefreshManager()
      const p1 = manager.refreshAndRetry()
      const p2 = manager.refreshAndRetry()

      resolveSession({ data: { session: baseSession, user: { id: `u-1` } } })

      const [r1, r2] = await Promise.all([p1, p2])
      expect(r1).toBe(true)
      expect(r2).toBe(true)
      expect(mockGetSession).toHaveBeenCalledTimes(1)
    })

    it(`a subsequent call after the in-flight refresh settles triggers a NEW underlying refresh`, async () => {
      const manager = new TokenRefreshManager()

      await manager.refreshAndRetry()
      await manager.refreshAndRetry()

      expect(mockGetSession).toHaveBeenCalledTimes(2)
    })

    it(`returns false without scheduling onAuthFailure when the session has no token`, async () => {
      mockGetSession.mockResolvedValueOnce({ data: { session: null } })

      const manager = new TokenRefreshManager()
      const result = await manager.refreshAndRetry()

      expect(result).toBe(false)
    })

    it(`returns false when getSession throws`, async () => {
      mockGetSession.mockRejectedValueOnce(new Error(`network down`))

      const manager = new TokenRefreshManager()
      const result = await manager.refreshAndRetry()

      expect(result).toBe(false)
    })
  })

  describe(`#scheduleNext timing`, () => {
    it(`with an expiresAt set, computes the delay as expiresAt - now - RefreshBufferMS`, () => {
      const setTimeoutSpy = vi.spyOn(globalThis, `setTimeout`)
      const manager = new TokenRefreshManager()

      // 5 minutes out: delay = 300_000 - RefreshBufferMS (120_000) = 180_000,
      // well above the MinCheckIntervalMS floor.
      manager.start(baseSession, vi.fn(), vi.fn())

      const [, delay] = setTimeoutSpy.mock.calls[0]
      expect(delay).toBe(5 * 60 * 1000 - RefreshBufferMS)
    })

    it(`clamps to MinCheckIntervalMS when the raw delay would be smaller (or negative)`, () => {
      const setTimeoutSpy = vi.spyOn(globalThis, `setTimeout`)
      const manager = new TokenRefreshManager()
      const almostExpired: TAuthSession = {
        ...baseSession,
        expiresAt: new Date(NOW + 10 * 1000).toISOString(), // 10s out
      }

      manager.start(almostExpired, vi.fn(), vi.fn())

      const [, delay] = setTimeoutSpy.mock.calls[0]
      expect(delay).toBe(MinCheckIntervalMS)
    })

    it(`falls back to FallbackCheckIntervalMS when there is no expiresAt`, () => {
      const setTimeoutSpy = vi.spyOn(globalThis, `setTimeout`)
      const manager = new TokenRefreshManager()
      const noExpiry: TAuthSession = { ...baseSession, expiresAt: undefined as any }

      manager.start(noExpiry, vi.fn(), vi.fn())

      const [, delay] = setTimeoutSpy.mock.calls[0]
      expect(delay).toBe(FallbackCheckIntervalMS)
    })
  })

  describe(`proactive refresh on timer fire`, () => {
    it(`on success calls onSessionUpdate and reschedules a new timer`, async () => {
      const onSessionUpdate = vi.fn()
      const onAuthFailure = vi.fn()
      const manager = new TokenRefreshManager()

      manager.start(baseSession, onSessionUpdate, onAuthFailure)
      const delay = 5 * 60 * 1000 - RefreshBufferMS

      await vi.advanceTimersByTimeAsync(delay)

      expect(onSessionUpdate).toHaveBeenCalledWith(baseSession)
      expect(onAuthFailure).not.toHaveBeenCalled()
      expect(vi.getTimerCount()).toBe(1)
    })

    it(`on failure calls onAuthFailure`, async () => {
      mockGetSession.mockResolvedValue({ data: { session: null } })
      const onSessionUpdate = vi.fn()
      const onAuthFailure = vi.fn()
      const manager = new TokenRefreshManager()

      manager.start(baseSession, onSessionUpdate, onAuthFailure)
      const delay = 5 * 60 * 1000 - RefreshBufferMS

      await vi.advanceTimersByTimeAsync(delay)

      expect(onAuthFailure).toHaveBeenCalledTimes(1)
      expect(onSessionUpdate).not.toHaveBeenCalled()
    })
  })

  describe(`#onVisibilityChange`, () => {
    it(`is a no-op when the document is not visible`, () => {
      const manager = new TokenRefreshManager()
      manager.start(baseSession, vi.fn(), vi.fn())
      const handler = getVisibilityHandler()

      setVisibility(`hidden`)
      handler()

      expect(mockGetSession).not.toHaveBeenCalled()
    })

    it(`is a no-op when there is no active session`, () => {
      const manager = new TokenRefreshManager()
      manager.start(baseSession, vi.fn(), vi.fn())
      const handler = getVisibilityHandler()

      manager.stop()
      setVisibility(`visible`)
      handler()

      expect(mockGetSession).not.toHaveBeenCalled()
    })

    it(`triggers a refresh when visible and within RefreshBufferMS of expiry`, async () => {
      const nearExpiry: TAuthSession = {
        ...baseSession,
        expiresAt: new Date(NOW + RefreshBufferMS - 1000).toISOString(),
      }
      const manager = new TokenRefreshManager()
      manager.start(nearExpiry, vi.fn(), vi.fn())
      const handler = getVisibilityHandler()

      setVisibility(`visible`)
      handler()
      // #doRefresh is fire-and-forget past an `await apiService.bearer()` before
      // it reaches authClient.getSession() — flush that microtask chain.
      await vi.advanceTimersByTimeAsync(0)

      expect(mockGetSession).toHaveBeenCalledTimes(1)
    })

    it(`is a no-op when visible but not yet within the refresh buffer of expiry`, () => {
      const manager = new TokenRefreshManager()
      manager.start(baseSession, vi.fn(), vi.fn())
      const handler = getVisibilityHandler()

      setVisibility(`visible`)
      handler()

      expect(mockGetSession).not.toHaveBeenCalled()
    })
  })
})

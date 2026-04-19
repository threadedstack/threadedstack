import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  checkTunnelRateLimit,
  recordTunnelFailure,
  clearTunnelFailures,
} from './onTunnelConnect'
import {
  TunnelRateLimit,
  TunnelRateWindow,
  TunnelBlockDuration,
} from '@TBE/constants/sandbox'

describe(`tunnel rate guard`, () => {
  beforeEach(() => {
    clearTunnelFailures()
  })

  it(`allows connections below rate limit`, () => {
    for (let i = 0; i < TunnelRateLimit - 1; i++) {
      recordTunnelFailure(`sb_1`)
    }
    expect(checkTunnelRateLimit(`sb_1`)).toBe(false)
  })

  it(`blocks connections at rate limit`, () => {
    for (let i = 0; i < TunnelRateLimit; i++) {
      recordTunnelFailure(`sb_1`)
    }
    expect(checkTunnelRateLimit(`sb_1`)).toBe(true)
  })

  it(`does not block after backoff expires`, () => {
    const now = Date.now()
    vi.spyOn(Date, `now`).mockReturnValue(now)

    for (let i = 0; i < TunnelRateLimit; i++) {
      recordTunnelFailure(`sb_1`)
    }
    expect(checkTunnelRateLimit(`sb_1`)).toBe(true)

    // Advance past block duration
    vi.spyOn(Date, `now`).mockReturnValue(now + TunnelBlockDuration + 1)
    expect(checkTunnelRateLimit(`sb_1`)).toBe(false)

    vi.restoreAllMocks()
  })

  it(`prunes stale entries outside the rate window`, () => {
    const now = Date.now()
    vi.spyOn(Date, `now`).mockReturnValue(now)

    for (let i = 0; i < TunnelRateLimit; i++) {
      recordTunnelFailure(`sb_1`)
    }

    // Advance past rate window — stale entries pruned on next check
    vi.spyOn(Date, `now`).mockReturnValue(now + TunnelRateWindow + 1)
    expect(checkTunnelRateLimit(`sb_1`)).toBe(false)

    vi.restoreAllMocks()
  })

  it(`clearTunnelFailures resets for a sandbox`, () => {
    for (let i = 0; i < TunnelRateLimit; i++) {
      recordTunnelFailure(`sb_1`)
    }
    clearTunnelFailures(`sb_1`)
    expect(checkTunnelRateLimit(`sb_1`)).toBe(false)
  })

  it(`independent sandbox IDs do not interfere`, () => {
    for (let i = 0; i < TunnelRateLimit; i++) {
      recordTunnelFailure(`sb_1`)
    }
    expect(checkTunnelRateLimit(`sb_1`)).toBe(true)
    expect(checkTunnelRateLimit(`sb_2`)).toBe(false)
  })
})

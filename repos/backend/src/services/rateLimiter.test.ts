import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import { InMemoryRateLimiter } from './rateLimiter'

describe(`InMemoryRateLimiter`, () => {
  let limiter: InMemoryRateLimiter

  beforeEach(() => {
    limiter = new InMemoryRateLimiter()
    vi.useFakeTimers()
    vi.setSystemTime(0)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe(`isLimited`, () => {
    it(`should return false for a key with no recorded timestamps`, () => {
      expect(limiter.isLimited(`key-1`, 1000, 3)).toBe(false)
    })

    it(`should return false when recorded count is below the limit`, () => {
      limiter.record(`key-1`)
      limiter.record(`key-1`)

      expect(limiter.isLimited(`key-1`, 1000, 3)).toBe(false)
    })

    it(`should return true once recorded count reaches the limit within the window`, () => {
      limiter.record(`key-1`)
      limiter.record(`key-1`)
      limiter.record(`key-1`)

      expect(limiter.isLimited(`key-1`, 1000, 3)).toBe(true)
    })

    it(`should ignore timestamps outside the sliding window`, () => {
      limiter.record(`key-1`)
      limiter.record(`key-1`)

      vi.setSystemTime(2000)
      limiter.record(`key-1`)

      // only the most recent record is within the 1000ms window
      expect(limiter.isLimited(`key-1`, 1000, 3)).toBe(false)
      expect(limiter.isLimited(`key-1`, 1000, 1)).toBe(true)
    })

    it(`should delete the key once all its timestamps age out of the window`, () => {
      limiter.record(`key-1`)

      vi.setSystemTime(5000)
      limiter.isLimited(`key-1`, 1000, 1)

      expect(limiter.isBlocked(`key-1`, 10_000)).toBe(false)
    })
  })

  describe(`isBlocked`, () => {
    it(`should return false for a key with no recorded timestamps`, () => {
      expect(limiter.isBlocked(`key-1`, 1000)).toBe(false)
    })

    it(`should return true while within the block duration of the last record`, () => {
      limiter.record(`key-1`)

      vi.setSystemTime(500)

      expect(limiter.isBlocked(`key-1`, 1000)).toBe(true)
    })

    it(`should return false and clear the key once the block duration elapses`, () => {
      limiter.record(`key-1`)

      vi.setSystemTime(1500)

      expect(limiter.isBlocked(`key-1`, 1000)).toBe(false)
      // key was cleared, so a fresh block check has nothing to block on
      expect(limiter.isBlocked(`key-1`, 1000)).toBe(false)
    })

    it(`should base the block window on the most recent record`, () => {
      limiter.record(`key-1`)

      vi.setSystemTime(900)
      limiter.record(`key-1`)

      vi.setSystemTime(1500)

      expect(limiter.isBlocked(`key-1`, 1000)).toBe(true)
    })
  })

  describe(`clear`, () => {
    it(`should remove only the specified key`, () => {
      limiter.record(`key-1`)
      limiter.record(`key-2`)

      limiter.clear(`key-1`)

      expect(limiter.isBlocked(`key-1`, 10_000)).toBe(false)
      expect(limiter.isBlocked(`key-2`, 10_000)).toBe(true)
    })

    it(`should remove all keys when called without an argument`, () => {
      limiter.record(`key-1`)
      limiter.record(`key-2`)

      limiter.clear()

      expect(limiter.isBlocked(`key-1`, 10_000)).toBe(false)
      expect(limiter.isBlocked(`key-2`, 10_000)).toBe(false)
    })
  })

  describe(`maxKeys eviction`, () => {
    it(`should evict the oldest-inserted key once maxKeys is exceeded`, () => {
      const bounded = new InMemoryRateLimiter(2)

      bounded.record(`key-1`)
      bounded.record(`key-2`)
      bounded.record(`key-3`)

      expect(bounded.isBlocked(`key-1`, 10_000)).toBe(false)
      expect(bounded.isBlocked(`key-2`, 10_000)).toBe(true)
      expect(bounded.isBlocked(`key-3`, 10_000)).toBe(true)
    })

    it(`should not evict when maxKeys is not exceeded`, () => {
      const bounded = new InMemoryRateLimiter(2)

      bounded.record(`key-1`)
      bounded.record(`key-2`)

      expect(bounded.isBlocked(`key-1`, 10_000)).toBe(true)
      expect(bounded.isBlocked(`key-2`, 10_000)).toBe(true)
    })
  })
})

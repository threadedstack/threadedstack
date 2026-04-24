/**
 * Rate limiter abstraction for multi-replica deployments.
 *
 * The `InMemoryRateLimiter` works for single-replica / local dev.
 * For production multi-replica, implement `TRateLimiterBackend` with
 * Redis (ZADD/ZRANGEBYSCORE) or a lightweight DB table.
 */

import type { TRateLimiterBackend } from '@TBE/types'
import { RateLimiterMaxKeys } from '@TBE/constants/sandbox'

export class InMemoryRateLimiter implements TRateLimiterBackend {
  private readonly entries = new Map<string, number[]>()
  private readonly maxKeys: number

  constructor(maxKeys = RateLimiterMaxKeys) {
    this.maxKeys = maxKeys
  }

  record(key: string): void {
    const timestamps = this.entries.get(key) || []
    timestamps.push(Date.now())
    this.entries.set(key, timestamps)

    if (this.entries.size > this.maxKeys) {
      const oldest = this.entries.keys().next().value
      if (oldest) this.entries.delete(oldest)
    }
  }

  isLimited(key: string, windowMs: number, limit: number): boolean {
    const timestamps = this.entries.get(key)
    if (!timestamps || timestamps.length === 0) return false

    const now = Date.now()
    const recent = timestamps.filter((t) => now - t < windowMs)
    this.entries.set(key, recent)

    if (recent.length === 0) {
      this.entries.delete(key)
      return false
    }

    return recent.length >= limit
  }

  isBlocked(key: string, blockDurationMs: number): boolean {
    const timestamps = this.entries.get(key)
    if (!timestamps || timestamps.length === 0) return false

    const lastFailure = timestamps[timestamps.length - 1]
    if (Date.now() - lastFailure > blockDurationMs) {
      this.entries.delete(key)
      return false
    }

    return true
  }

  clear(key?: string): void {
    if (key) this.entries.delete(key)
    else this.entries.clear()
  }
}

export type TRateLimiterBackend = {
  /** Record a failure/event for the given key at the current timestamp. */
  record(key: string): void
  /** Clear recorded events for a specific key, or all keys if omitted. */
  clear(key?: string): void
  /** Check if the key has exceeded `limit` events within `windowMs`. */
  isLimited(key: string, windowMs: number, limit: number): boolean
  /** Check if the key is within a block period after exceeding the limit. */
  isBlocked(key: string, blockDurationMs: number): boolean
}

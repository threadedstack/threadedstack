/**
 * Retry configuration derived from endpoint options
 */
export type TRetryConfig = {
  /** Maximum number of retry attempts */
  maxRetries: number
  /** Initial delay in milliseconds */
  initialDelay: number
  /** Maximum delay in milliseconds */
  maxDelay: number
  /** Backoff multiplier for exponential backoff */
  backoffMultiplier: number
  /** Whether to use exponential backoff */
  exponentialBackoff: boolean
}

/**
 * Retry metadata attached to request
 */
export type TRetryMetadata = {
  attempt: number
  maxRetries: number
  lastError?: any
  startTime: number
}

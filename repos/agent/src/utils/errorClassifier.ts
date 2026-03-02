/**
 * Patterns that indicate transient (retryable) errors.
 * Rate limits, network timeouts, and temporary server errors.
 */
const TRANSIENT_PATTERNS = [
  /rate.?limit/i,
  /too many requests/i,
  /429/,
  /503/,
  /502/,
  /timeout/i,
  /timed out/i,
  /ECONNRESET/,
  /ECONNREFUSED/,
  /ETIMEDOUT/,
  /ENETUNREACH/,
  /socket hang up/i,
  /network.?error/i,
  /overloaded/i,
  /temporarily unavailable/i,
  /service unavailable/i,
  /internal server error/i,
  /retry after/i,
  /please retry/i,
]

/**
 * Returns true if the error message indicates a transient failure
 * that can be retried with a reasonable chance of success.
 */
export const isTransientError = (error: string): boolean =>
  TRANSIENT_PATTERNS.some((p) => p.test(error))

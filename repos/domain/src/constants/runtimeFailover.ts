/**
 * Runtime-brain provider-failover primitives — shared by every consumer that
 * drives a `claude -p` child against a priority-ordered AI-provider chain:
 * the scheduled executor (one-shot pods) AND the resident runtime (in-pod
 * long-running loop). One source of truth so both fail over identically.
 */

/** Additional attempts after the first when a runtime run hits a transient upstream error. */
export const CliMaxTransientRetries = 2

/** Backoff (ms) before each transient retry, indexed by attempt (0-based). */
export const CliTransientRetryDelaysMs = [5000, 15000]

/**
 * Same-provider transient retries to spend BEFORE failing over to the next
 * provider in the chain. Kept low (1) so a dead provider doesn't burn the full
 * transient-retry budget when a healthy fallback is available; the terminal
 * provider (no fallbacks left) still exhausts CliMaxTransientRetries.
 */
export const CliSameProviderRetriesBeforeFailover = 1

/**
 * Safety cap on how many fallback providers the runtime brain will advance
 * through in one cycle. Set generously above any realistic provider-list length
 * so it never limits below the number of configured fallbacks.
 */
export const CliMaxProviderFailovers = 8

/**
 * Transient upstream failure signal — 5xx status codes, "Overloaded"/529, and
 * rate-limit language returned by the CLI brain when its LLM provider is
 * temporarily unavailable. No `g` flag, so it is safe for both `.test` and
 * `.match` (no shared lastIndex).
 */
const TransientUpstreamRegex =
  /\b529\b|overloaded|API Error:\s*5\d\d|rate.?limit|\b503\b|\b502\b|500 Internal/i

/** Return the first matched transient-upstream signal in `text`, if any. */
export const matchTransientSignal = (text: string): string | undefined => {
  if (!text) return undefined
  return text.match(TransientUpstreamRegex)?.[0]
}

/**
 * Detect a transient upstream failure signal in captured output — 5xx status
 * codes, "Overloaded"/529, and rate-limit language returned by the CLI brain
 * when its LLM provider is temporarily unavailable. Used to decide whether a
 * failed runtime run is worth retrying in the same pod / failing over.
 */
export const isTransientUpstreamFailure = (text: string): boolean => {
  if (!text) return false
  return TransientUpstreamRegex.test(text)
}

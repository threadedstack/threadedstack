/**
 * Constants for the agent task-delegation system (P3a).
 * Delegation spawns a bounded in-pod child coding process (runtime promptCommand
 * via the K8s exec API); these caps bound depth, concurrency, runtime, and output.
 */

/**
 * Maximum delegation depth. Depth 0 is the root agent; a child spawned at
 * depth >= DelegationMaxDepth may never delegate again.
 */
export const DelegationMaxDepth = 1

/** Maximum concurrently running delegated tasks per agent session. */
export const DelegationConcurrencyCap = 3

/** Default wall-clock timeout for a delegated child process. */
export const DelegationDefaultTimeoutMs = 10 * 60_000

/** Ceiling for caller-provided delegation timeouts. */
export const DelegationMaxTimeoutMs = 30 * 60_000

/**
 * How far BEFORE the deadline an exec rejection still counts as "timed out".
 *
 * The child exec and the wall-clock race that waits on it are armed with the
 * same budget, so the child's own deadline rejection is expected to land at or
 * after that instant. Node timers do not guarantee it: libuv compares against a
 * cached loop time, so a `setTimeout(fn, ms)` callback can run when only
 * `ms - 1` has elapsed on the clock. Judged against an exact `>= timeoutMs`
 * boundary that rejection is misread as a genuine failure, the captured stdout
 * tail is discarded, and the caller gets a raw error instead of the graceful
 * timed-out result — the precise loss the mapping exists to prevent.
 *
 * 25 ms is ~25x the 1 ms of rounding it has to absorb, and still only 2.5% of
 * the 1000 ms floor delegation timeouts are clamped up to, so a genuine mid-run
 * failure is reported as a failure rather than swallowed as a deadline. The
 * captured tail is returned either way; only the error string differs.
 */
export const DelegationTimeoutSlackMs = 25

/** Maximum critic assessment passes per delegated task. */
export const DelegationCriticMaxRounds = 1

/** Tail-cap for captured child stdout returned to the delegating agent. */
export const DelegationOutputMaxChars = 16_000

/**
 * Env var carrying the delegation depth into the child process. Defense in
 * depth: an in-pod CLI cannot call delegateTask, but any future execution path
 * that can must read this and refuse past DelegationMaxDepth.
 */
export const DelegationDepthEnvVar = `TDSK_DELEGATION_DEPTH`

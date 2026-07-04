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

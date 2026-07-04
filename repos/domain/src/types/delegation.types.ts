import type { TSandboxRuntimeId } from './sandbox.types'

/**
 * Types for the agent task-delegation system (P3a).
 * A delegated task runs as a bounded in-pod child coding process (the runtime's
 * promptCommand via the K8s exec API), NOT as a nested AgentRunner — depth is
 * naturally bounded because an in-pod CLI cannot call our delegateTask tool,
 * and the depth env var is threaded anyway for defense in depth.
 */

/** Input for a single delegated task. */
export type TDelegateInput = {
  /** The self-contained task prompt handed to the child coding process */
  task: string
  /** Override the child runtime (defaults to the body sandbox's runtime) */
  runtime?: TSandboxRuntimeId
  /**
   * Advisory tool constraints prepended to the child prompt. Runtime-agnostic:
   * in-pod CLIs have no uniform tool-restriction flag, so this is a prompt
   * constraint, not an enforced allowlist.
   */
  tools?: string[]
  /** Wall-clock timeout for the child process (clamped to DelegationMaxTimeoutMs) */
  timeoutMs?: number
}

/** Bounded critic assessment of a delegated task's output. */
export type TDelegateCritic = {
  passed: boolean
  reason: string
}

/** Structured result returned to the delegating agent. */
export type TDelegateResult = {
  /** True only when the child exited 0 AND the critic (when it ran) passed */
  success: boolean
  /** Child stdout, tail-capped to DelegationOutputMaxChars */
  output: string
  /** Child process exit code (absent on timeout or refusal) */
  exitCode?: number
  /** Failure reason for refusals (depth/concurrency caps), timeouts, and exec errors */
  error?: string
  /** Critic verdict — absent when the critic was skipped or its verdict was unparseable */
  critic?: TDelegateCritic
}

import type { TDelegateInput, TDelegateResult } from '@tdsk/domain'

/**
 * Injected delegation provider for the api-brain agent (P3a delegation).
 * Mirrors the IMemoryProvider/ISkillProvider pattern: the agent package
 * declares the capability contract, the backend implements it (bounded in-pod
 * child coding process via the runtime promptCommand + K8s exec API) and
 * injects an instance through the AgentRunner init opts.
 */
export interface IDelegateProvider {
  /**
   * Run one delegated task as a bounded child coding process in the agent's
   * body sandbox. Never rejects for task-level failures — refusals (depth/
   * concurrency caps), timeouts, and exec errors come back as a failed
   * TDelegateResult so the agent can react in-turn.
   */
  delegate(input: TDelegateInput): Promise<TDelegateResult>
}

/** Depth options threaded from the runner into createDelegateTools. */
export type TDelegateToolOpts = {
  /** Current delegation depth of THIS agent (0 = root) */
  delegationDepth?: number
  /** Max depth; the tool refuses once delegationDepth reaches it */
  maxDelegationDepth?: number
}

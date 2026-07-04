/**
 * Injected task provider for the api-brain agent (P4a self-direction).
 * Mirrors the ISkillProvider pattern: the agent package declares the capability
 * contract, the backend implements it (taskProposal db service + the deterministic
 * security scan) and injects an instance through the AgentRunner init opts.
 */
export interface ITaskProvider {
  /**
   * Sense a new task PROPOSAL (never an active task). The backend dedupes
   * against any still-open proposal for the same dedupe key, then runs a
   * deterministic security scan and returns the resulting status; a scanned
   * proposal is later picked by the work cycle, a failed one is rejected.
   */
  proposeTask(input: {
    title: string
    description: string
    priority: string
    evidence: string
    sourceSignal: string
    dedupeKey?: string
    repos?: string[]
  }): Promise<{ id: string; status: string; findings: string[]; deduped: boolean }>
}

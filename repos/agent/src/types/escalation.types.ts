/**
 * Injected escalation provider for the api-brain agent (P4b self-ownership).
 * Mirrors the ITaskProvider pattern: the agent package declares the capability
 * contract, the backend implements it (escalation db service + routing logic)
 * and injects an instance through the AgentRunner init opts.
 */
export interface IEscalationProvider {
  /**
   * Open a new escalation (or return the existing open row for the same dedupeKey).
   * Idempotent: if an open or routed row with the same dedupeKey already exists,
   * it is returned with deduped=true without creating a new one.
   */
  escalate(input: {
    title: string
    problem: string
    evidence?: string[]
    proposedPatch?: string
    target: string // constrained to app|ops|infra|secrets at the domain level, validated at execute time
    dedupeKey?: string
    issueRef?: string
  }): Promise<{ id: string; status: string; routable: boolean; deduped: boolean }>
}

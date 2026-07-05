/**
 * Injected ops provider for the api-brain agent (P4d self-ownership).
 * The agent package declares the capability contract; the backend implements
 * it (ops service + deterministic scan) and injects an instance through the
 * AgentRunner init opts (wired in D9).
 *
 * READ tier methods execute inline and each writes an ops_actions audit row.
 * WRITE tier is stubbed in D5 — D6 replaces with the full proposal machinery.
 */
export interface IOpsProvider {
  // READ tier — each returns typed data and audits itself server-side.
  podStatus(params: {
    component?: string
    podName?: string
  }): Promise<{ ok: boolean; pods: any[]; error?: string }>

  podLogs(params: {
    component?: string
    podName?: string
    tailLines?: number
    previous?: boolean
  }): Promise<{ ok: boolean; logs: string; error?: string }>

  deployState(params: { deployment?: string }): Promise<{
    ok: boolean
    deployments: any[]
    error?: string
  }>

  quotaUsage(params: Record<string, never>): Promise<{
    ok: boolean
    quotas: any[]
    error?: string
  }>

  // WRITE tier — routes to a propose+dry-run+scan flow. Stubbed in D5, real in D6.
  // Returns the created ops-action id + its status/findings/dryRun payload; NEVER executes inline.
  propose(
    action: string,
    params: any
  ): Promise<{
    opsActionId: string
    status: string
    findings: string[]
    dryRun: any | null
  }>
}

/**
 * Verification type definitions for post-merge safety net (P4c).
 * After a steward PR merges + deploys, a verify cycle checks the change's
 * declared success probe against prod. On regression it opens a revert-as-new-commit
 * PR and files a target:app escalation via the P4b path.
 */

/** How a merged PR declared it should be verified in prod. */
export enum EVerifyProbeKind {
  health = `health`, // curl a health endpoint; assert body.status === 'ok'
  ciGreen = `ci-green`, // gh run list --branch main --limit 1; assert conclusion === 'success'
  markerAdvanced = `marker-advanced`, // origin/production must contain the merge SHA (deploy landed)
  assertion = `assertion`, // run a shell command in-pod; assert exit 0
}

export type TVerifyProbeKind = `${EVerifyProbeKind}`

/** Probe declaration attached to a PR body via a ```tdsk-verify``` block. Default when absent. */
export type TVerifyProbe = {
  kind: TVerifyProbeKind
  params?: Record<string, any> // e.g. {url:'/_/health'} for health, {command:'…'} for assertion
}

/** Lifecycle of a verification row. */
export enum EVerificationStatus {
  pending = `pending`, // seen the PR merge, probe not yet run this cycle
  verifying = `verifying`, // probe running (transient — real steward exec is synchronous, but the row supports resume)
  verified = `verified`, // terminal: probe passed
  regressed = `regressed`, // terminal: probe failed → revert PR opened + escalation
}

export type TVerificationStatus = `${EVerificationStatus}`

/** A single result emitted by the verify cycle in a ```tdsk-verify-results``` block. */
export type TVerifyResult = {
  prNumber: number
  mergeSha?: string
  status: 'verified' | 'regressed'
  detail?: string
  revertPrUrl?: string // set when the cycle already opened a revert PR
}

/** Verification row — one per merged steward PR. */
export type TVerification = {
  id: string
  orgId: string
  agentId: string
  prNumber: number
  prUrl: string | null
  mergeSha: string | null
  probe: TVerifyProbe
  status: TVerificationStatus
  detail: string | null
  revertPrUrl: string | null
  escalationId: string | null // FK to escalations.id if a regressed run opened one
  meta: Record<string, any> | null
  createdAt?: string | Date
  updatedAt?: string | Date
}

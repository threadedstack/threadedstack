/**
 * Escalation type definitions for agent self-ownership (P4b).
 * An escalation is opened when the steward hits a need it cannot yet act on:
 *   secrets (hard-line issue-only path), ops/infra (pre-P4d/P4e), or any
 *   audited request + patch it wants tracked. The escalation opens a GitHub
 *   issue AND auto-routes to a faculty the steward already has when applicable.
 */

/** Lifecycle status of an escalation. */
export enum EEscalationStatus {
  open = `open`, // just opened; issue-only path (secrets) or awaiting a faculty
  routed = `routed`, // auto-routed to a faculty the steward can already act on (app today)
  resolved = `resolved`, // the underlying need was met (fix PR merged, human closed)
  rejected = `rejected`, // decided not to act
}

export type TEscalationStatus = `${EEscalationStatus}`

/** Target subsystem the escalation is for. `secrets` is the hard-line issue-only path. */
export enum EEscalationTarget {
  app = `app`,
  ops = `ops`,
  infra = `infra`,
  secrets = `secrets`,
}

export type TEscalationTarget = `${EEscalationTarget}`

/** Input a caller supplies to open an escalation. */
export type TEscalationInput = {
  title: string
  problem: string
  evidence?: string[]
  proposedPatch?: string
  target: TEscalationTarget
  dedupeKey?: string
  issueRef?: string // gh issue URL, populated after `gh issue create`
  meta?: Record<string, any>
}

/** A resolution decision emitted by a later cycle. */
export type TEscalationResolution = {
  id?: string
  dedupeKey?: string
  status: `resolved` | `rejected`
  resolvedRef?: string // PR url that fixed it, or closing ref
  reason?: string
}

/** Full escalation row shape. */
export type TEscalation = {
  id: string
  orgId: string
  agentId: string
  title: string
  problem: string
  evidence: string[]
  proposedPatch: string | null
  target: TEscalationTarget
  status: TEscalationStatus
  dedupeKey: string
  issueRef: string | null
  resolvedRef: string | null
  reason: string | null
  meta: Record<string, any> | null
  createdAt?: string | Date
  updatedAt?: string | Date
}

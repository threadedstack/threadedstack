/**
 * Task-proposal type definitions for agent self-direction (P4a).
 * A proposal is a self-sensed task pending an automatic promotion gate:
 *   pending → (security scan) → scanned → (auditor review) → promoted | rejected
 * Promotion creates a TASKS.md entry; the deterministic scan is the hard gate.
 */

import type { TScanResult, TAuditVerdict } from './skillProposal.types'

/** Lifecycle status of a task proposal. */
export enum ETaskProposalStatus {
  pending = `pending`, // just sensed, scan not yet run
  scanned = `scanned`, // passed the security scan, awaiting auditor review
  rejected = `rejected`, // failed the scan, or the auditor/human rejected it
  promoted = `promoted`, // approved + promoted to a TASKS.md entry
}

export type TTaskProposalStatus = `${ETaskProposalStatus}`

/** Priority tier assigned to a task proposal. */
export enum ETaskPriority {
  P0 = `P0`,
  P1 = `P1`,
  P2 = `P2`,
  P3 = `P3`,
  P4 = `P4`,
}

export type TTaskPriority = `${ETaskPriority}`

/** Sensor that originated a task proposal. */
export enum ETaskSourceSignal {
  ci = `ci`,
  deployMarker = `deploy-marker`,
  health = `health`,
  scheduleRun = `schedule-run`,
  log = `log`,
  other = `other`,
}

export type TTaskSourceSignal = `${ETaskSourceSignal}`

/**
 * Input for sensing a task proposal (id/org/agent resolved by the caller).
 * Mirrors the active task shape minus lifecycle fields.
 */
export type TTaskProposalInput = {
  title: string
  description: string
  priority: TTaskPriority
  evidence: string
  sourceSignal: TTaskSourceSignal
  dedupeKey: string
  repos?: string[]
  parentId?: string
  initiative?: string
  meta?: Record<string, any>
}

/** Task-proposal record — stored in DB, scoped to an org + sensing agent. */
export type TTaskProposal = {
  id: string
  orgId: string
  agentId: string
  title: string
  description: string
  priority: TTaskPriority
  evidence: string
  sourceSignal: TTaskSourceSignal
  dedupeKey: string
  repos: string[]
  status: TTaskProposalStatus
  scanResult: TScanResult | null
  auditVerdict: TAuditVerdict | null
  prUrl: string | null
  reason: string | null
  parentId: string | null
  initiative: string | null
  meta: Record<string, any> | null
  createdAt?: string | Date
  updatedAt?: string | Date
}

/** A pickup record linking a promoted task proposal to its resulting PR. */
export type TTaskPickup = {
  proposalId: string
  prUrl?: string
  note?: string
}

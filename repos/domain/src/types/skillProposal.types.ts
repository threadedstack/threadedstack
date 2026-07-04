/**
 * Skill-proposal type definitions for agent self-improvement (P3b).
 * A proposal is a self-authored skill pending an automatic promotion gate:
 *   pending → (security scan) → scanned → (auditor review) → promoted | rejected
 * Promotion creates an active `skills` row; the deterministic scan is the hard gate.
 */

/** Lifecycle status of a skill proposal. */
export enum ESkillProposalStatus {
  pending = `pending`, // just authored, scan not yet run
  scanned = `scanned`, // passed the security scan, awaiting auditor review
  rejected = `rejected`, // failed the scan, or the auditor/human rejected it
  promoted = `promoted`, // approved + promoted to an active skill
}

export type TSkillProposalStatus = `${ESkillProposalStatus}`

/** Result of the deterministic security scan gating a proposal. */
export type TScanResult = {
  passed: boolean
  findings: string[]
}

/** An auditor/human decision recorded on a proposal. */
export type TAuditVerdict = {
  approved: boolean
  reason: string
  by?: string // agentId of the auditor, or a userId for a human veto
}

/** A single review decision emitted by the auditor for one proposal. */
export type TSkillReview = {
  proposalId: string
  approve: boolean
  reason?: string
}

/**
 * Input for authoring a skill proposal (id/org/agent resolved by the caller).
 * Mirrors the active `skills` shape minus lifecycle fields.
 */
export type TSkillAuthorInput = {
  name: string
  description: string
  instructions: string
  tools?: string[]
  triggerKeywords?: string[]
  alwaysActive?: boolean
  meta?: Record<string, any>
}

/** Skill-proposal record — stored in DB, scoped to an org + authoring agent. */
export type TSkillProposal = {
  id: string
  orgId: string
  agentId: string
  name: string
  description: string
  instructions: string
  tools: string[]
  triggerKeywords: string[]
  alwaysActive: boolean
  status: TSkillProposalStatus
  scanResult: TScanResult | null
  auditVerdict: TAuditVerdict | null
  promotedSkillId: string | null
  reason: string | null
  meta: Record<string, any> | null
  createdAt?: string | Date
  updatedAt?: string | Date
}

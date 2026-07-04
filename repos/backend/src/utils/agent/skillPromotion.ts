import type { TDatabase } from '@tdsk/database'
import type { TApp } from '@TBE/types'
import type { SkillProposal, TSkillReview, TSkillAuthorInput } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { ESkillProposalStatus } from '@tdsk/domain'
import { scanSkillProposal } from '@TBE/utils/agent/skillScan'

/**
 * Promotion pipeline for self-authored skills (P3b). Shared by:
 *  - the api-brain `authorSkill` tool provider (resolveAgentConfig)
 *  - the runtime-brain executor capture (persistSkillProposals / persistSkillReviews)
 *  - the admin/HTTP review endpoint (reviewSkillProposal)
 *
 * The deterministic scan is the HARD GATE — it runs at authoring time AND again
 * before promotion, and is fail-closed.
 */

type TAuthorResult = { id: string; status: string; findings: string[] }

/**
 * Create a skill proposal and run the security scan immediately.
 * Scan pass → status=scanned (awaiting auditor review). Scan fail → status=rejected.
 */
export const authorSkillProposal = async (
  db: TDatabase,
  orgId: string,
  agentId: string,
  input: TSkillAuthorInput,
  meta?: Record<string, any>
): Promise<TAuthorResult> => {
  const scan = scanSkillProposal(input)
  const status = scan.passed
    ? ESkillProposalStatus.scanned
    : ESkillProposalStatus.rejected

  const { data, error } = await db.services.skillProposal.create({
    orgId,
    agentId,
    name: input.name,
    description: input.description,
    instructions: input.instructions,
    tools: input.tools ?? [],
    triggerKeywords: input.triggerKeywords ?? [],
    alwaysActive: input.alwaysActive ?? false,
    status,
    scanResult: scan,
    reason: scan.passed ? null : `Security scan failed: ${scan.findings.join(`; `)}`,
    meta: meta ?? input.meta ?? null,
  } as any)

  if (error || !data) {
    logger.warn(
      `[skill] Failed to create proposal for agent ${agentId}: ${error?.message ?? `unknown`}`
    )
    throw new Error(`Failed to create skill proposal: ${error?.message ?? `unknown`}`)
  }

  if (!scan.passed)
    logger.warn(
      `[skill] Proposal ${data.id} rejected by scan: ${scan.findings.join(`; `)}`
    )

  return { id: data.id, status, findings: scan.findings }
}

/**
 * Promote a scanned proposal to an active skill: create the skill row, attach it
 * to the authoring agent, and mark the proposal promoted. Assumes the caller has
 * already re-run and passed the scan.
 */
export const promoteSkillProposal = async (
  db: TDatabase,
  proposal: SkillProposal,
  reason: string,
  by?: string
): Promise<{ skillId: string }> => {
  const { data: skill, error: skillErr } = await db.services.skill.create({
    orgId: proposal.orgId,
    name: proposal.name,
    description: proposal.description,
    instructions: proposal.instructions,
    tools: proposal.tools ?? [],
    triggerKeywords: proposal.triggerKeywords ?? [],
    alwaysActive: proposal.alwaysActive ?? false,
  } as any)

  if (skillErr || !skill)
    throw new Error(`Failed to create skill: ${skillErr?.message ?? `unknown`}`)

  await db.services.skill.addAgent(skill.id, proposal.agentId)

  await db.services.skillProposal.update({
    id: proposal.id,
    status: ESkillProposalStatus.promoted,
    promotedSkillId: skill.id,
    auditVerdict: { approved: true, reason, by },
  } as any)

  logger.info(`[skill] Promoted proposal ${proposal.id} → skill ${skill.id}`)
  return { skillId: skill.id }
}

/** Mark a proposal rejected with an auditor/human reason. */
export const rejectSkillProposal = async (
  db: TDatabase,
  proposal: SkillProposal,
  reason: string,
  by?: string
): Promise<void> => {
  await db.services.skillProposal.update({
    id: proposal.id,
    status: ESkillProposalStatus.rejected,
    reason,
    auditVerdict: { approved: false, reason, by },
  } as any)
  logger.info(`[skill] Rejected proposal ${proposal.id}: ${reason}`)
}

/**
 * Apply a single review decision to a proposal. Terminal proposals
 * (promoted/rejected) are skipped. On approve, the scan is RE-RUN as the hard
 * gate — a proposal that no longer passes is rejected regardless of the verdict.
 * Returns the resulting status, or null when the proposal was not actionable.
 */
export const applySkillReview = async (
  db: TDatabase,
  orgId: string,
  review: TSkillReview,
  by?: string
): Promise<string | null> => {
  const { data: proposal, error } = await db.services.skillProposal.get(review.proposalId)
  if (error || !proposal) return null
  if (proposal.orgId !== orgId) return null
  if (
    proposal.status === ESkillProposalStatus.promoted ||
    proposal.status === ESkillProposalStatus.rejected
  )
    return null

  const reason =
    review.reason ?? (review.approve ? `Approved by auditor` : `Rejected by auditor`)

  if (!review.approve) {
    await rejectSkillProposal(db, proposal, reason, by)
    return ESkillProposalStatus.rejected
  }

  // Hard gate: re-scan before promotion.
  const scan = scanSkillProposal(proposal)
  if (!scan.passed) {
    await rejectSkillProposal(
      db,
      proposal,
      `Re-scan failed at promotion: ${scan.findings.join(`; `)}`,
      by
    )
    return ESkillProposalStatus.rejected
  }

  await promoteSkillProposal(db, proposal, reason, by)
  return ESkillProposalStatus.promoted
}

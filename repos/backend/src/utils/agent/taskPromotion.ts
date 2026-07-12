import type { TDatabase } from '@tdsk/database'
import type {
  TaskProposal,
  TTaskProposalInput,
  TTaskPickup,
  TTaskProposalStatus,
} from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { ETaskProposalStatus } from '@tdsk/domain'
import { scanTaskProposal } from '@TBE/utils/agent/taskScan'
import { mirrorTaskProposalToCollection } from '@TBE/utils/agent/taskProposalMirror'

/**
 * Promotion pipeline for self-sensed task proposals (P4a). Shared by:
 *  - the runtime-brain sensing capture (persists sensed tasks as proposals)
 *  - the work-cycle pickup path (marks a scanned proposal promoted once a PR opens)
 *  - the admin/HTTP review endpoint (async reject override)
 *
 * task_proposals ARE the backlog: the deterministic scan is the hard gate at
 * authoring time — no human sits on the critical path. Promotion re-uses that
 * verdict (no re-scan) since the work cycle only ever picks scanned proposals
 * and CI gates the resulting PR.
 */

type TAuthorResult = {
  id: string
  status: TTaskProposalStatus
  findings: string[]
  deduped: boolean
}

/**
 * Create a task proposal, deduping first against any still-open proposal for
 * the same dedupe key, then running the security scan immediately.
 * Scan pass → status=scanned (eligible for the work cycle). Scan fail → status=rejected.
 *
 * Insert-first, not check-then-insert: two replicas racing the same dedupeKey
 * both attempting createIfAbsent can no longer both succeed — the DB-level
 * partial unique index (org_id, dedupe_key) WHERE status IN ('pending','scanned')
 * means only one INSERT wins, and the loser re-fetches the winner's row via
 * findOpenByDedupeKey rather than blindly inserting a duplicate.
 */
export const authorTaskProposal = async (
  db: TDatabase,
  orgId: string,
  agentId: string,
  input: TTaskProposalInput,
  meta?: Record<string, any>
): Promise<TAuthorResult> => {
  const scan = scanTaskProposal(input)
  const status = scan.passed ? ETaskProposalStatus.scanned : ETaskProposalStatus.rejected

  const { data, error, conflict } = await db.services.taskProposal.createIfAbsent({
    orgId,
    agentId,
    title: input.title,
    description: input.description,
    priority: input.priority,
    evidence: input.evidence,
    sourceSignal: input.sourceSignal,
    dedupeKey: input.dedupeKey,
    repos: input.repos ?? [],
    parentId: input.parentId ?? null,
    initiative: input.initiative ?? null,
    status,
    scanResult: scan,
    reason: scan.passed ? null : `Security scan failed: ${scan.findings.join(`; `)}`,
    meta: meta ?? input.meta ?? null,
  } as any)

  if (conflict) {
    const { data: existing } = await db.services.taskProposal.findOpenByDedupeKey(
      orgId,
      input.dedupeKey
    )
    if (existing)
      return { id: existing.id, status: existing.status, findings: [], deduped: true }

    throw new Error(`Failed to create task proposal: conflicting row not found`)
  }

  if (error || !data) {
    logger.warn(
      `[task] Failed to create proposal for agent ${agentId}: ${error?.message ?? `unknown`}`
    )
    throw new Error(`Failed to create task proposal: ${error?.message ?? `unknown`}`)
  }

  if (!scan.passed)
    logger.warn(
      `[task] Proposal ${data.id} rejected by scan: ${scan.findings.join(`; `)}`
    )

  // Best-effort mirror of the just-created row into the ops Collection so the
  // resident-facing surface tracks the table between deploys. Never throws —
  // the table (already written above) stays authoritative.
  await mirrorTaskProposalToCollection(db, data as any)

  return { id: data.id, status, findings: scan.findings, deduped: false }
}

/**
 * Mark a scanned proposal promoted once the work cycle has picked it up and
 * opened a PR. Idempotent — terminal proposals (promoted/rejected) are
 * skipped. No re-scan and no human gate here: the scan already ran at
 * authoring time, and CI gates the resulting PR.
 */
export const markTaskPromoted = async (
  db: TDatabase,
  orgId: string,
  pickup: TTaskPickup,
  by?: string
): Promise<TTaskProposalStatus | null> => {
  const { data: proposal } = await db.services.taskProposal.get(pickup.proposalId)
  if (!proposal || proposal.orgId !== orgId) return null
  if (
    proposal.status === ETaskProposalStatus.promoted ||
    proposal.status === ETaskProposalStatus.rejected
  )
    return null

  const { data: updated } = await db.services.taskProposal.update({
    id: proposal.id,
    status: ETaskProposalStatus.promoted,
    prUrl: pickup.prUrl ?? null,
    reason: pickup.note ?? `Picked by work cycle`,
    auditVerdict: { approved: true, reason: pickup.note ?? `picked`, by },
  } as any)

  // Best-effort mirror of the promoted row into the ops Collection so the
  // resident-facing surface reflects the status change between deploys. Never
  // throws — the table update above stays authoritative.
  if (updated) await mirrorTaskProposalToCollection(db, updated as any)

  logger.info(`[task] Promoted proposal ${proposal.id}`)
  return ETaskProposalStatus.promoted
}

/**
 * Mark a proposal rejected via an async admin override. Never blocks the
 * work cycle — it only filters the proposal out of the backlog.
 */
export const rejectTaskProposal = async (
  db: TDatabase,
  proposal: TaskProposal,
  reason: string,
  by?: string
): Promise<TTaskProposalStatus> => {
  await db.services.taskProposal.update({
    id: proposal.id,
    status: ETaskProposalStatus.rejected,
    reason,
    auditVerdict: { approved: false, reason, by },
  } as any)

  logger.info(`[task] Rejected proposal ${proposal.id}: ${reason}`)
  return ETaskProposalStatus.rejected
}

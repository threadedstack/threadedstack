import type { TDatabase } from '@tdsk/database'
import type {
  Escalation,
  TEscalationInput,
  TEscalationResolution,
  TEscalationStatus,
} from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import {
  EEscalationStatus,
  EEscalationTarget,
  EscalationRoutableTargets,
} from '@tdsk/domain'

/**
 * Routing util for agent escalations (P4b). Shared by:
 *  - the runtime-brain executor capture (persist escalation blocks from stdout)
 *  - the work-cycle resolution path (mark an escalation resolved once a fix PR merges)
 *
 * Routing decision is deterministic at creation time:
 *   - target === 'secrets'  → status 'open' (hard-line: issue-only path, never routed)
 *   - target in EscalationRoutableTargets (app today) → status 'routed'
 *   - anything else (ops/infra pre-P4d/P4e) → status 'open'
 *
 * The GH issue URL is created in-pod by the runtime brain (`gh issue create`) and
 * passed in as input.issueRef. The backend never shells GitHub directly.
 * The proposedPatch is NOT auto-applied here — any code changes land as a normal
 * steward/* PR gated by scanner + CI + adversary review.
 */

/**
 * Open a new escalation (or return the existing open row for the same dedupeKey).
 * Idempotent: if an open or routed row with the same dedupeKey already exists for
 * this org, it is returned without creating a new one.
 */
export const openEscalation = async (
  db: TDatabase,
  orgId: string,
  agentId: string,
  input: TEscalationInput,
  meta?: Record<string, any>
): Promise<{
  id: string
  status: TEscalationStatus
  routable: boolean
  deduped: boolean
}> => {
  const dedupeKey = (input.dedupeKey ?? `${input.target}:${input.title}`).slice(0, 200)

  const { data: existing } = await db.services.escalation.openByDedupeKey(
    orgId,
    dedupeKey
  )
  if (existing)
    return { id: existing.id, status: existing.status, routable: false, deduped: true }

  const routable = EscalationRoutableTargets.includes(input.target)
  const status: TEscalationStatus =
    input.target === EEscalationTarget.secrets
      ? EEscalationStatus.open
      : routable
        ? EEscalationStatus.routed
        : EEscalationStatus.open

  const { data, error } = await db.services.escalation.create({
    orgId,
    agentId,
    dedupeKey,
    target: input.target,
    status,
    title: input.title,
    problem: input.problem,
    evidence: input.evidence ?? [],
    proposedPatch: input.proposedPatch ?? null,
    issueRef: input.issueRef ?? null,
    resolvedRef: null,
    reason: null,
    meta: meta ?? input.meta ?? null,
  } as any)

  if (error || !data) {
    logger.warn(
      `[escalation] Failed to create escalation for agent ${agentId}: ${error?.message ?? `unknown`}`
    )
    throw new Error(`Failed to open escalation: ${error?.message ?? `unknown`}`)
  }

  logger.info(
    `[escalation] Opened escalation ${data.id} (target=${input.target}, status=${status})`
  )
  return { id: data.id, status, routable, deduped: false }
}

/**
 * Resolve or reject an existing escalation. Idempotent: terminal rows (resolved/rejected)
 * are skipped and null is returned. The resolvedRef is typically the URL of the fix PR
 * (routed → resolved chain).
 */
export const resolveEscalation = async (
  db: TDatabase,
  orgId: string,
  res: TEscalationResolution,
  by?: string
): Promise<`resolved` | `rejected` | null> => {
  let row: Escalation | undefined

  if (res.id) {
    row = (await db.services.escalation.get(res.id)).data ?? undefined
  } else if (res.dedupeKey) {
    row =
      (await db.services.escalation.openByDedupeKey(orgId, res.dedupeKey)).data ??
      undefined
  }

  if (!row || row.orgId !== orgId) return null
  if (
    row.status === EEscalationStatus.resolved ||
    row.status === EEscalationStatus.rejected
  )
    return null

  await db.services.escalation.update({
    id: row.id,
    status: res.status,
    resolvedRef: res.resolvedRef ?? row.resolvedRef,
    reason: res.reason ?? row.reason,
  } as any)

  logger.info(`[escalation] ${res.status} escalation ${row.id}${by ? ` by ${by}` : ``}`)
  return res.status
}

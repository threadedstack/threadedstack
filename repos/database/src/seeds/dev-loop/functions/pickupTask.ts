import { EFunLanguage } from '@tdsk/domain'

/**
 * `pickupTask` — dev-loop effect Function (Dev-Loop on Primitives ⑤b-2).
 *
 * Parity port of `persistTaskPickups` (repos/backend/src/services/scheduler/
 * executor.ts:727) + `markTaskPromoted` (repos/backend/src/utils/agent/
 * taskPromotion.ts:94-118) + the `parseTaskPickupsBlock` validation
 * (repos/backend/src/utils/agent/task.ts:118-140), against the ① `records`
 * capability. Marks a scanned proposal promoted once the work cycle has picked
 * it up and opened a PR. Idempotent — terminal proposals (promoted/rejected)
 * are skipped. No re-scan and no human gate: the scan already ran at authoring
 * time, and CI gates the resulting PR.
 */
export const PickupTaskFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  // Caller trust — persistTaskPickups (executor.ts:727) forwards the
  // schedule's trusted agentId as the promoting identity; require it.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }

  // Input validation — parseTaskPickupsBlock (task.ts:118-140): entries
  // missing a non-empty proposalId are dropped; prUrl/note optional, trimmed.
  const proposalId = typeof args.proposalId === 'string' ? args.proposalId.trim() : ''
  if (!proposalId) return { ok: false, reason: 'proposalId is required' }
  const prUrl = typeof args.prUrl === 'string' && args.prUrl.trim() ? args.prUrl.trim() : null
  const note = typeof args.note === 'string' && args.note.trim() ? args.note.trim() : null

  // Locate — markTaskPromoted (taskPromotion.ts:100-101): get by id; the
  // orgId ownership check there is the records bridge's project scoping here.
  const proposal = await records.get('task_proposals', proposalId)
  if (!proposal) return { ok: true, promoted: false, reason: 'proposal not found' }

  // Idempotent — terminal proposals (promoted/rejected) are skipped
  // (taskPromotion.ts:102-106).
  if (proposal.data.status === 'promoted' || proposal.data.status === 'rejected')
    return { ok: true, promoted: false, reason: 'proposal already terminal' }

  // Promote — taskPromotion.ts:108-114: status promoted + prUrl + reason +
  // auditVerdict { approved, reason, by: promoting agent }. No re-scan.
  const data = Object.assign({}, proposal.data, {
    status: 'promoted',
    prUrl: prUrl,
    reason: note !== null ? note : 'Picked by work cycle',
    auditVerdict: {
      approved: true,
      reason: note !== null ? note : 'picked',
      by: caller.agentId,
    },
  })
  await records.upsert('task_proposals', { id: proposal.id, data: data })
  return { ok: true, promoted: true, id: proposal.id, status: 'promoted' }
}
`

/** Seed record for the `pickupTask` Function (stable id — idempotent reconcile). */
export const PickupTaskFunctionDef = {
  id: `fn_tpickup`,
  name: `pickupTask`,
  description: `Mark a scanned dev-loop task proposal promoted (status promoted + prUrl + auditVerdict) once the work cycle picked it up and opened a PR. Idempotent — terminal (promoted/rejected) proposals are skipped. Replaces the hard-coded persistTaskPickups/markTaskPromoted handler.`,
  language: EFunLanguage.javascript,
  content: PickupTaskFunctionSource,
}

import { EFunLanguage } from '@tdsk/domain'

/**
 * `openDecision` — board effect Function (Exec-Board on Primitives ⑤a-3).
 *
 * Parity port of `persistDecisions` (repos/backend/src/services/scheduler/
 * executor.ts:591-659) + the `parseDecisionsBlock` input validation (repos/
 * domain/src/constants/board.ts:81-109), re-expressed against the ① `records`
 * capability. One invocation opens ONE proposal (the `tdsk-actions` block
 * carries one action per entry, replacing the parsed array loop).
 *
 * Board membership is data (`board_members` records) resolved from the trusted
 * platform-injected `context.caller` (spec §5.1) — never from model-emitted args.
 */
export const OpenDecisionFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  // Board-member gate — executor.ts:596-598 (isBoardMemberSchedule + agentId
  // guard), resolved from board_members records via the trusted caller.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  const members = await records.query('board_members', {
    where: [{ field: 'agentId', op: 'eq', value: caller.agentId }],
  })
  if (!members.length) return { ok: false, reason: 'caller is not a board member' }

  // Input validation — parseDecisionsBlock (domain constants/board.ts:94-95):
  // non-empty title + description, axis in the EDecisionAxis set (board.types.ts:24-31).
  const title = typeof args.title === 'string' ? args.title.trim() : ''
  const description = typeof args.description === 'string' ? args.description.trim() : ''
  const axis = typeof args.axis === 'string' ? args.axis : ''
  const validAxes = ['segment', 'positioning', 'pricing', 'active-initiative', 'resource-bet', 'other']
  if (!title || !description) return { ok: false, reason: 'title and description are required' }
  if (validAxes.indexOf(axis) === -1) return { ok: false, reason: 'invalid axis: ' + axis }
  const evidence = Array.isArray(args.evidence)
    ? args.evidence.filter((ref) => typeof ref === 'string')
    : []

  // Dedupe against still-open proposals by trimmed lowercase title —
  // executor.ts:607-623 (listOpenByOrg = status open|deliberating; org scoping
  // is the records bridge's project scoping here).
  const open = await records.query('decision_proposals', {
    where: [{ field: 'status', op: 'in', value: ['open', 'deliberating'] }],
  })
  const key = title.toLowerCase()
  const duplicate = open.some(
    (rec) => typeof rec.data.title === 'string' && rec.data.title.trim().toLowerCase() === key
  )
  if (duplicate) return { ok: true, opened: false, deduped: true, title: title }

  // Open the proposal — executor.ts:625-634 (status open, round 1, opener = caller).
  const created = await records.upsert('decision_proposals', {
    data: {
      title: title,
      axis: axis,
      description: description,
      evidence: evidence,
      status: 'open',
      round: 1,
      openedByAgentId: caller.agentId,
    },
  })
  return { ok: true, opened: true, proposalId: created.id }
}
`

/** Seed record for the `openDecision` Function (stable id — idempotent reconcile). */
export const OpenDecisionFunctionDef = {
  id: `fn_bopend1`,
  name: `openDecision`,
  description: `Open an executive-board decision proposal (status open, round 1). Caller must hold a board_members record; dedupes by title against still-open proposals. Replaces the hard-coded persistDecisions handler.`,
  language: EFunLanguage.javascript,
  content: OpenDecisionFunctionSource,
}

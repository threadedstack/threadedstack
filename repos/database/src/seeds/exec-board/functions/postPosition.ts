import { EFunLanguage } from '@tdsk/domain'

/**
 * `postPosition` — board effect Function (Exec-Board on Primitives ⑤a-3).
 *
 * Parity port of `persistDecisionPositions` (repos/backend/src/services/
 * scheduler/executor.ts:668-731) + the `parseDecisionPositionsBlock` input
 * validation (repos/domain/src/constants/board.ts:116-140), against the ①
 * `records` capability. Records the caller's stance on a proposal at the
 * proposal's CURRENT round; a position on a missing or already-resolved
 * proposal is a no-op, exactly as today.
 *
 * Uniqueness on (proposalId, agentId, round) — the spec §4 upsert-key
 * convention: an existing same-round record is replaced in place (the records
 * primitive has no unique index).
 */
export const PostPositionFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  // Board-member gate — executor.ts:673-675, resolved from board_members
  // records via the trusted platform-injected caller.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  const members = await records.query('board_members', {
    where: [{ field: 'agentId', op: 'eq', value: caller.agentId }],
  })
  if (!members.length) return { ok: false, reason: 'caller is not a board member' }

  // Input validation — parseDecisionPositionsBlock (domain constants/
  // board.ts:129-130): non-empty proposalId + reasoning, stance in the EStance set.
  const proposalId = typeof args.proposalId === 'string' ? args.proposalId.trim() : ''
  const reasoning = typeof args.reasoning === 'string' ? args.reasoning.trim() : ''
  const stance = typeof args.stance === 'string' ? args.stance : ''
  const validStances = ['endorse', 'object', 'amend']
  if (!proposalId || !reasoning) return { ok: false, reason: 'proposalId and reasoning are required' }
  if (validStances.indexOf(stance) === -1) return { ok: false, reason: 'invalid stance: ' + stance }

  // A position on an unknown or already-resolved proposal is a no-op —
  // executor.ts:687-697 (the orgId check there is the records bridge's
  // project scoping here).
  const proposal = await records.get('decision_proposals', proposalId)
  if (
    !proposal ||
    (proposal.data.status !== 'open' && proposal.data.status !== 'deliberating')
  )
    return { ok: true, recorded: false, reason: 'proposal missing or already resolved' }

  // Record the stance at the proposal's CURRENT round — executor.ts:699-706.
  // Upsert keyed (proposalId, agentId, round): replace an existing same-round record.
  const round = proposal.data.round
  const existing = await records.query('decision_positions', {
    where: [
      { field: 'proposalId', op: 'eq', value: proposalId },
      { field: 'agentId', op: 'eq', value: caller.agentId },
      { field: 'round', op: 'eq', value: round },
    ],
  })
  const data = {
    proposalId: proposalId,
    agentId: caller.agentId,
    stance: stance,
    reasoning: reasoning,
    round: round,
  }
  const saved = await records.upsert(
    'decision_positions',
    existing.length ? { id: existing[0].id, data: data } : { data: data }
  )
  return { ok: true, recorded: true, positionId: saved.id }
}
`

/** Seed record for the `postPosition` Function (stable id — idempotent reconcile). */
export const PostPositionFunctionDef = {
  id: `fn_bposit1`,
  name: `postPosition`,
  description: `Post the caller's per-round stance (endorse/object/amend) on an open board decision proposal. Caller must hold a board_members record; upserts by (proposalId, caller, round). Replaces the hard-coded persistDecisionPositions handler.`,
  language: EFunLanguage.javascript,
  content: PostPositionFunctionSource,
}

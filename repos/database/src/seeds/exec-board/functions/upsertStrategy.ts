import { EFunLanguage } from '@tdsk/domain'

/**
 * `upsertStrategy` — board effect Function (Exec-Board on Primitives ⑤a-3).
 *
 * Parity port of `persistStrategy` (repos/backend/src/services/scheduler/
 * executor.ts:741-780) + the `parseStrategyBlock` field validation (repos/
 * domain/src/constants/board.ts:162-201), against the ① `records` capability.
 * Patches ONLY the non-active-initiative fields (northStar / segments /
 * positioning / backlog, last-write-wins) of the single `company_strategy`
 * record — the Active Initiative NEVER moves through here (only via the
 * completion gate or a committed active-initiative proposal).
 *
 * CEO-only: the caller's `board_members` record must carry `isCEO:true`,
 * resolved from the trusted platform-injected `context.caller` (spec §5.1).
 */
export const UpsertStrategyFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  // CEO gate — executor.ts:746 (isCeoSchedule): only the board_members record
  // with isCEO true may write the strategy, resolved via the trusted caller.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  const members = await records.query('board_members', {
    where: [{ field: 'agentId', op: 'eq', value: caller.agentId }],
  })
  const member = members[0]
  if (!member || member.data.isCEO !== true)
    return { ok: false, reason: 'only the CEO may write the strategy' }

  // Keep only the recognized, correctly-typed fields — parseStrategyBlock
  // (domain constants/board.ts:175-197). activeInitiative is NOT a recognized
  // field (executor.ts:735-739), so a smuggled value can never land.
  const patch = {}
  let hasField = false
  if (typeof args.northStar === 'string' && args.northStar.trim()) {
    patch.northStar = args.northStar.trim()
    hasField = true
  }
  if (Array.isArray(args.segments)) {
    patch.segments = args.segments.filter((seg) => typeof seg === 'string')
    hasField = true
  }
  if (typeof args.positioning === 'string' && args.positioning.trim()) {
    patch.positioning = args.positioning.trim()
    hasField = true
  }
  if (Array.isArray(args.backlog)) {
    patch.backlog = args.backlog
      .filter(
        (item) =>
          item &&
          typeof item === 'object' &&
          typeof item.title === 'string' &&
          item.title.trim() &&
          typeof item.rationale === 'string' &&
          item.rationale.trim() &&
          typeof item.priority === 'number' &&
          Number.isFinite(item.priority)
      )
      .map((item) => ({
        title: item.title.trim(),
        rationale: item.rationale.trim(),
        priority: item.priority,
      }))
    hasField = true
  }
  if (!hasField) return { ok: false, reason: 'no recognized strategy fields' }
  // The patch records its writer — executor.ts:756-764 (updatedByAgentId).
  patch.updatedByAgentId = caller.agentId

  // Last-write-wins patch of the single company_strategy record — the
  // companyStrategy.upsertByOrg port (companyStrategy.ts:60-78): the first
  // call creates, every later call patches the same record; untouched fields
  // (including activeInitiative) are preserved from the current record.
  const existing = await records.query('company_strategy', {})
  const current = existing[0]
  const data = current
    ? Object.assign({}, current.data, patch)
    : Object.assign(
        { northStar: '', segments: [], positioning: '', backlog: [], activeInitiative: null },
        patch
      )
  const saved = await records.upsert(
    'company_strategy',
    current ? { id: current.id, data: data } : { data: data }
  )
  return { ok: true, strategyId: saved.id }
}
`

/** Seed record for the `upsertStrategy` Function (stable id — idempotent reconcile). */
export const UpsertStrategyFunctionDef = {
  id: `fn_bstrat1`,
  name: `upsertStrategy`,
  description: `Patch the single company_strategy record (northStar/segments/positioning/backlog, last-write-wins). CEO-only (caller's board_members record must be isCEO); never touches the Active Initiative. Replaces the hard-coded persistStrategy handler.`,
  language: EFunLanguage.javascript,
  content: UpsertStrategyFunctionSource,
}

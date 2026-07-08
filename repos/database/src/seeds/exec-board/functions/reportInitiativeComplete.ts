import { EFunLanguage } from '@tdsk/domain'

/**
 * `reportInitiativeComplete` — board effect Function (Exec-Board on Primitives ⑤a-3).
 *
 * Parity port of `persistInitiativeComplete` (repos/backend/src/services/
 * scheduler/executor.ts:796-877), against the ① `records` capability. The ONLY
 * routine trigger that unlocks re-direction of the frozen Active Initiative: a
 * report is accepted ONLY when it matches the frozen initiative exactly (right
 * title, still `active`, non-empty evidence). On accept: mark the delivered
 * initiative `complete`, then promote the next backlog item (its rationale
 * becomes the definition-of-done — companyStrategy.promoteNextFromBacklog:
 * 128-152) or clear when the backlog is empty. Any mismatch is a no-op.
 *
 * CTO-only: the caller's `board_members` record must carry `role:'cto'`,
 * resolved from the trusted platform-injected `context.caller` (spec §5.1).
 * The executor's memory write-back (executor.ts:846-855) is platform-side
 * telemetry with no isolate capability, so it does not ride along (plan §3
 * step 4 scopes the Function to gate + complete + advance).
 */
export const ReportInitiativeCompleteFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  // CTO gate — executor.ts:801 (isCtoSchedule): only the board_members record
  // with role 'cto' may report completion, resolved via the trusted caller.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  const members = await records.query('board_members', {
    where: [{ field: 'agentId', op: 'eq', value: caller.agentId }],
  })
  const member = members[0]
  if (!member || member.data.role !== 'cto')
    return { ok: false, reason: 'only the CTO may report initiative completion' }

  // Input validation — parseInitiativeCompleteBlock (domain constants/
  // board.ts:222-228): non-empty title, evidenceRefs coerced to string[].
  const title = typeof args.title === 'string' ? args.title.trim() : ''
  const evidenceRefs = Array.isArray(args.evidenceRefs)
    ? args.evidenceRefs.filter((ref) => typeof ref === 'string')
    : []
  if (!title) return { ok: false, reason: 'title is required' }

  const strategies = await records.query('company_strategy', {})
  const strategy = strategies[0]
  const active = strategy && strategy.data ? strategy.data.activeInitiative : null

  // Completion gate — executor.ts:817-830: accept ONLY a report that matches
  // the frozen Active Initiative exactly (right title, still active, non-empty
  // evidence); anything else keeps the initiative frozen (no advance).
  if (
    !active ||
    active.status !== 'active' ||
    String(active.title).trim() !== title ||
    evidenceRefs.length === 0
  )
    return {
      ok: true,
      advanced: false,
      reason: 'report did not match the frozen Active Initiative; no advance',
    }

  // Mark the delivered initiative complete (audit) — executor.ts:835-838.
  await records.upsert('company_strategy', {
    id: strategy.id,
    data: Object.assign({}, strategy.data, {
      activeInitiative: Object.assign({}, active, { status: 'complete' }),
    }),
  })

  // Advance the loop — executor.ts:839-842: promote the next backlog bet as
  // the new Active Initiative (companyStrategy.promoteNextFromBacklog:139-148 —
  // the FIRST backlog item; its rationale becomes the definition-of-done,
  // evidence starts empty, status active), or clear when the backlog is empty.
  const refreshed = await records.query('company_strategy', {})
  const currentRec = refreshed[0]
  const backlog = Array.isArray(currentRec.data.backlog) ? currentRec.data.backlog : []
  if (backlog.length > 0) {
    const next = backlog[0]
    await records.upsert('company_strategy', {
      id: currentRec.id,
      data: Object.assign({}, currentRec.data, {
        activeInitiative: {
          title: next.title,
          definitionOfDone: next.rationale,
          evidence: [],
          status: 'active',
          committedAt: new Date().toISOString(),
        },
        backlog: backlog.slice(1),
      }),
    })
  } else {
    await records.upsert('company_strategy', {
      id: currentRec.id,
      data: Object.assign({}, currentRec.data, { activeInitiative: null }),
    })
  }

  return { ok: true, advanced: true, completedTitle: title }
}
`

/** Seed record for the `reportInitiativeComplete` Function (stable id — idempotent reconcile). */
export const ReportInitiativeCompleteFunctionDef = {
  id: `fn_binitc1`,
  name: `reportInitiativeComplete`,
  description: `Report the frozen Active Initiative delivered (exact title match, still active, non-empty evidenceRefs): marks it complete and promotes the next backlog item or clears. CTO-only (caller's board_members record role must be cto). Replaces the hard-coded persistInitiativeComplete handler.`,
  language: EFunLanguage.javascript,
  content: ReportInitiativeCompleteFunctionSource,
}

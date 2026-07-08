import { EFunLanguage } from '@tdsk/domain'

/**
 * `resolveEscalation` — dev-loop effect Function (Dev-Loop on Primitives ⑤b-2).
 *
 * Parity port of the resolution path of `persistEscalations` (repos/backend/
 * src/services/scheduler/executor.ts:814, resolutions loop) + `resolveEscalation`
 * (repos/backend/src/utils/agent/escalationPromotion.ts:100-132) + the
 * `parseEscalationResolutionsBlock` validation (repos/backend/src/utils/agent/
 * escalation.ts:66-101), against the ① `records` capability. Resolves or
 * rejects an existing escalation; idempotent — terminal rows (resolved/
 * rejected) are skipped.
 *
 * The old handler's durable "escalation resolved" memory side-write is NOT
 * ported — prompts emit tdsk-memories at cutover (Phase 4, the ⑤a-4 precedent).
 */
export const ResolveEscalationFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  // Caller trust — persistEscalations (executor.ts:814) forwards the
  // schedule's trusted agentId as the resolving identity; require it.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }

  // Input validation — parseEscalationResolutionsBlock (escalation.ts:81-86):
  // status must be resolved|rejected; at least one of id / dedupeKey required.
  const status = typeof args.status === 'string' ? args.status : ''
  if (status !== 'resolved' && status !== 'rejected')
    return { ok: false, reason: 'invalid status: ' + status }
  const id = typeof args.id === 'string' && args.id.trim() ? args.id.trim() : null
  const dedupeKey =
    typeof args.dedupeKey === 'string' && args.dedupeKey.trim()
      ? args.dedupeKey.trim()
      : null
  if (!id && !dedupeKey) return { ok: false, reason: 'id or dedupeKey is required' }
  const resolvedRef =
    typeof args.resolvedRef === 'string' && args.resolvedRef.trim()
      ? args.resolvedRef.trim()
      : null
  const reason =
    typeof args.reason === 'string' && args.reason.trim() ? args.reason.trim() : null

  // Locate — resolveEscalation (escalationPromotion.ts:106-114): by id first,
  // else the newest still-open (open|routed) row for the dedupeKey
  // (openByDedupeKey orders newest-first; records return in insertion order,
  // so the last match is the newest).
  let row = null
  if (id) {
    row = await records.get('escalations', id)
  } else {
    const matches = await records.query('escalations', {
      where: [
        { field: 'dedupeKey', op: 'eq', value: dedupeKey },
        { field: 'status', op: 'in', value: ['open', 'routed'] },
      ],
    })
    row = matches.length ? matches[matches.length - 1] : null
  }

  // Missing row → no-op; terminal rows (resolved/rejected) are skipped
  // (escalationPromotion.ts:116-121). The orgId ownership check there is the
  // records bridge's project scoping here.
  if (!row) return { ok: true, updated: false, reason: 'escalation not found' }
  if (row.data.status === 'resolved' || row.data.status === 'rejected')
    return { ok: true, updated: false, reason: 'escalation already terminal' }

  // Update — escalationPromotion.ts:123-128: status + resolvedRef/reason with
  // fall-through to the existing values when the resolution omits them.
  const prior = row.data
  const data = Object.assign({}, prior, {
    status: status,
    resolvedRef:
      resolvedRef !== null ? resolvedRef : prior.resolvedRef != null ? prior.resolvedRef : null,
    reason: reason !== null ? reason : prior.reason != null ? prior.reason : null,
  })
  await records.upsert('escalations', { id: row.id, data: data })
  return { ok: true, updated: true, id: row.id, status: status }
}
`

/** Seed record for the `resolveEscalation` Function (stable id — idempotent reconcile). */
export const ResolveEscalationFunctionDef = {
  id: `fn_escreso`,
  name: `resolveEscalation`,
  description: `Resolve or reject an existing dev-loop escalation (located by id, or by dedupeKey against still-open rows), setting resolvedRef/reason with fall-through to prior values. Idempotent — terminal (resolved/rejected) rows are skipped. Replaces the hard-coded persistEscalations/resolveEscalation handler.`,
  language: EFunLanguage.javascript,
  content: ResolveEscalationFunctionSource,
}

import { EFunLanguage } from '@tdsk/domain'

/**
 * `openEscalation` — dev-loop effect Function (Dev-Loop on Primitives ⑤b-2).
 *
 * Parity port of `persistEscalations` (repos/backend/src/services/scheduler/
 * executor.ts:814) + `openEscalation` (repos/backend/src/utils/agent/
 * escalationPromotion.ts:37-93) + the `parseEscalationBlock` validation
 * (repos/backend/src/utils/agent/escalation.ts:22-58), against the ① `records`
 * capability.
 *
 * Routing decision is deterministic at creation time (escalationPromotion.ts
 * header + :58-64):
 *   - target === 'secrets' → status 'open' (hard-line: issue-only, never routed)
 *   - target in EscalationRoutableTargets ([app]) → status 'routed'
 *   - anything else (ops/infra) → status 'open'
 *
 * The old handler's resolved-escalation memory side-write is NOT ported —
 * prompts emit tdsk-memories at cutover (Phase 4, the ⑤a-4 precedent).
 */
export const OpenEscalationFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  // Caller trust — persistEscalations (executor.ts:814) forwards the
  // schedule's trusted agentId as the opener; require it.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }

  // Input validation — parseEscalationBlock (escalation.ts:35-36): non-empty
  // title + problem; target must be one of the EEscalationTarget values.
  const title = typeof args.title === 'string' ? args.title.trim() : ''
  const problem = typeof args.problem === 'string' ? args.problem.trim() : ''
  const target = typeof args.target === 'string' ? args.target : ''
  const validTargets = ['app', 'ops', 'infra', 'secrets']
  if (!title || !problem) return { ok: false, reason: 'title and problem are required' }
  if (validTargets.indexOf(target) === -1)
    return { ok: false, reason: 'invalid target: ' + target }
  const evidence = Array.isArray(args.evidence)
    ? args.evidence.filter((v) => typeof v === 'string')
    : []
  const proposedPatch =
    typeof args.proposedPatch === 'string' && args.proposedPatch.trim()
      ? args.proposedPatch.trim()
      : null
  const issueRef =
    typeof args.issueRef === 'string' && args.issueRef.trim()
      ? args.issueRef.trim()
      : null

  // dedupeKey — provided, else target + ':' + title, capped at 200 chars
  // (escalationPromotion.ts:49).
  const dedupeKey = (
    typeof args.dedupeKey === 'string' && args.dedupeKey.trim()
      ? args.dedupeKey.trim()
      : target + ':' + title
  ).slice(0, 200)

  // Dedupe — openEscalation (escalationPromotion.ts:51-56) via openByDedupeKey
  // (escalation service:61-86): open means status open|routed, so a repeat
  // sensing collapses onto a live escalation but never a closed one.
  const existing = await records.query('escalations', {
    where: [
      { field: 'dedupeKey', op: 'eq', value: dedupeKey },
      { field: 'status', op: 'in', value: ['open', 'routed'] },
    ],
  })
  if (existing.length)
    return {
      ok: true,
      id: existing[0].id,
      status: existing[0].data.status,
      routable: false,
      deduped: true,
    }

  // Deterministic routing at creation time — escalationPromotion.ts:58-64.
  const routable = target === 'app'
  const status = target === 'secrets' ? 'open' : routable ? 'routed' : 'open'

  // Provenance meta — persistEscalations (executor.ts:820) prefers the
  // platform meta over input meta (openEscalation: meta ?? input.meta ?? null).
  const meta = caller.scheduleId
    ? { scheduleId: caller.scheduleId }
    : args.meta && typeof args.meta === 'object' && !Array.isArray(args.meta)
      ? args.meta
      : null

  // Create — escalationPromotion.ts:66-80 field-for-field; the opener is the
  // trusted caller (openedByAgentId <- caller.agentId).
  const created = await records.upsert('escalations', {
    data: {
      dedupeKey: dedupeKey,
      target: target,
      status: status,
      title: title,
      problem: problem,
      evidence: evidence,
      proposedPatch: proposedPatch,
      issueRef: issueRef,
      resolvedRef: null,
      reason: null,
      meta: meta,
      openedByAgentId: caller.agentId,
    },
  })
  return { ok: true, id: created.id, status: status, routable: routable, deduped: false }
}
`

/** Seed record for the `openEscalation` Function (stable id — idempotent reconcile). */
export const OpenEscalationFunctionDef = {
  id: `fn_escopen`,
  name: `openEscalation`,
  description: `Open a dev-loop escalation with deterministic routing (secrets => open, app => routed, ops/infra => open); dedupes by dedupeKey against still-open (open|routed) escalations. Replaces the hard-coded persistEscalations/openEscalation handler.`,
  language: EFunLanguage.javascript,
  content: OpenEscalationFunctionSource,
}

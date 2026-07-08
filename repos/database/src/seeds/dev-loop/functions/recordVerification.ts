import { EFunLanguage } from '@tdsk/domain'

/**
 * `recordVerification` — dev-loop effect Function (Dev-Loop on Primitives ⑤b-2).
 *
 * Parity port of `persistVerifications` (repos/backend/src/services/scheduler/
 * executor.ts:975) + `verification.upsertByPr` (repos/database/src/services/
 * verification.ts:84-110) + the `parseVerifyResultsBlock` validation
 * (repos/backend/src/utils/agent/verify.ts:53-83), against the ① `records`
 * capability. Multi-collection write in one body: a `regressed` result ALSO
 * upserts a target:'app' escalation record (the exact `openEscalation` shaping
 * the handler uses — executor.ts:984-1002) before upserting the verification
 * row keyed by prNumber.
 *
 * The old handler's durable "PR verify" memory side-write is NOT ported —
 * prompts emit tdsk-memories at cutover (Phase 4, the ⑤a-4 precedent).
 */
export const RecordVerificationFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  // Caller trust — persistVerifications (executor.ts:975) forwards the
  // schedule's trusted agentId through to the escalation + upsert; require it.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }

  // Input validation — parseVerifyResultsBlock (verify.ts:62-79): prNumber a
  // positive integer (Number()-coerced — string digits accepted), status
  // exactly verified|regressed; optional fields only when non-empty.
  const prNumber = Number(args.prNumber)
  if (!Number.isInteger(prNumber) || prNumber <= 0)
    return { ok: false, reason: 'prNumber must be a positive integer' }
  const status = args.status
  if (status !== 'verified' && status !== 'regressed')
    return { ok: false, reason: 'invalid status: ' + String(status) }
  const mergeSha =
    typeof args.mergeSha === 'string' && args.mergeSha.trim()
      ? args.mergeSha.trim()
      : null
  const detail =
    typeof args.detail === 'string' && args.detail.trim() ? args.detail.trim() : null
  const revertPrUrl =
    typeof args.revertPrUrl === 'string' && args.revertPrUrl.trim()
      ? args.revertPrUrl.trim()
      : null

  // Regression → escalation cross-write (executor.ts:984-1002): file a
  // target:'app' escalation citing the revert PR (the steward already opened
  // the revert in-pod; the escalation is the audit trail). Exact shaping
  // ported: dedupeKey 'verify-regression-pr<N>', title, problem defaulting to
  // the declared-probe message, evidence [mergeSha, revertPrUrl] compacted,
  // issueRef = revertPrUrl. openEscalation semantics inline
  // (escalationPromotion.ts:37-93): dedupe against still-open (open|routed)
  // rows by dedupeKey, else create with deterministic routing (app → routed).
  let escalationId = null
  if (status === 'regressed') {
    const dedupeKey = 'verify-regression-pr' + prNumber
    const existing = await records.query('escalations', {
      where: [
        { field: 'dedupeKey', op: 'eq', value: dedupeKey },
        { field: 'status', op: 'in', value: ['open', 'routed'] },
      ],
    })
    if (existing.length) {
      escalationId = existing[0].id
    } else {
      // Provenance meta — executor.ts:999 ({ scheduleId, prNumber }).
      const meta = { prNumber: prNumber }
      if (caller.scheduleId) meta.scheduleId = caller.scheduleId
      const esc = await records.upsert('escalations', {
        data: {
          dedupeKey: dedupeKey,
          target: 'app',
          status: 'routed',
          title: 'Post-deploy regression: PR #' + prNumber,
          problem:
            detail !== null ? detail : 'Declared verify probe failed after deploy.',
          evidence: [mergeSha, revertPrUrl].filter(Boolean),
          proposedPatch: null,
          issueRef: revertPrUrl,
          resolvedRef: null,
          reason: null,
          meta: meta,
          openedByAgentId: caller.agentId,
        },
      })
      escalationId = esc.id
    }
  }

  // Upsert by PR — verification.upsertByPr (verification.ts:84-110): the
  // (org, prNumber) pair is unique (project scope here); an existing row is
  // patched in place, else a new row is created with DefaultVerifyProbe
  // ({ kind: 'ci-green' }) and the trusted caller as the verifying agent.
  const patch = {
    status: status,
    detail: detail,
    mergeSha: mergeSha,
    revertPrUrl: revertPrUrl,
    escalationId: escalationId,
  }
  const found = await records.query('verifications', {
    where: [{ field: 'prNumber', op: 'eq', value: prNumber }],
  })
  let id
  if (found.length) {
    id = found[0].id
    await records.upsert('verifications', {
      id: id,
      data: Object.assign({}, found[0].data, patch),
    })
  } else {
    const created = await records.upsert('verifications', {
      data: Object.assign(
        {
          prNumber: prNumber,
          probe: { kind: 'ci-green' },
          agentId: caller.agentId,
        },
        patch
      ),
    })
    id = created.id
  }
  return { ok: true, id: id, status: status, escalationId: escalationId }
}
`

/** Seed record for the `recordVerification` Function (stable id — idempotent reconcile). */
export const RecordVerificationFunctionDef = {
  id: `fn_recverf`,
  name: `recordVerification`,
  description: `Record a post-merge verification result upserted by prNumber (verified|regressed); a regressed result also upserts a target:'app' routed escalation citing the revert PR (multi-collection write). Replaces the hard-coded persistVerifications handler.`,
  language: EFunLanguage.javascript,
  content: RecordVerificationFunctionSource,
}

import { EFunLanguage } from '@tdsk/domain'

/**
 * `proposeTask` — dev-loop effect Function (Dev-Loop on Primitives ⑤b-2).
 *
 * Parity port of `persistTaskProposals` (repos/backend/src/services/scheduler/
 * executor.ts:685) + `authorTaskProposal` (repos/backend/src/utils/agent/
 * taskPromotion.ts:37-86) + the `parseTasksBlock` per-entry validation
 * (repos/backend/src/utils/agent/task.ts:68-111), re-expressed against the ①
 * `records` capability and the ⑤b-1 `context.scan` capability. One invocation
 * proposes ONE task (the `tdsk-actions` block carries one action per entry,
 * replacing the parsed array loop).
 *
 * Caller trust model: the handler passes the schedule's trusted agentId
 * straight through — same model here: `context.caller.agentId` is required
 * (platform-injected, never model-emitted) and recorded as `proposedByAgentId`;
 * there is no membership gate.
 *
 * Scan gate is fail-closed AND row-creating: a failing scan still CREATES the
 * proposal with status `rejected` + the verdict + a reason (authorTaskProposal
 * taskPromotion.ts:52-70) — it is never silently skipped.
 */
export const ProposeTaskFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records
  const scan = context.scan

  // Caller trust — persistTaskProposals (executor.ts:685) forwards the
  // schedule's trusted agentId; require the platform-injected identity.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }

  // Input validation — parseTasksBlock (task.ts:80-85): entries missing a
  // non-empty title / description / evidence are dropped.
  const title = typeof args.title === 'string' ? args.title.trim() : ''
  const rawDescription = typeof args.description === 'string' ? args.description.trim() : ''
  const rawEvidence = typeof args.evidence === 'string' ? args.evidence.trim() : ''
  if (!title || !rawDescription || !rawEvidence)
    return { ok: false, reason: 'title, description and evidence are required' }

  // Coercions — coercePriority/coerceSourceSignal (task.ts:26-34): invalid
  // values fall back to P3 / other. Truncation caps (task.ts:92-94):
  // TaskMaxDescriptionChars=6000, TaskMaxEvidenceChars=4000.
  const validPriorities = ['P0', 'P1', 'P2', 'P3', 'P4']
  const validSignals = ['ci', 'deploy-marker', 'health', 'schedule-run', 'log', 'other']
  const priority = validPriorities.indexOf(args.priority) !== -1 ? args.priority : 'P3'
  const sourceSignal =
    validSignals.indexOf(args.sourceSignal) !== -1 ? args.sourceSignal : 'other'
  const description = rawDescription.slice(0, 6000)
  const evidence = rawEvidence.slice(0, 4000)

  // dedupeKey — provided, else derived as sourceSignal + ':' + slug(title),
  // capped at 200 chars (deriveDedupeKey, task.ts:44-52).
  let dedupeKey
  if (typeof args.dedupeKey === 'string' && args.dedupeKey.trim()) {
    dedupeKey = args.dedupeKey.trim()
  } else {
    const prefix = sourceSignal + ':'
    const available = Math.max(0, 200 - prefix.length)
    const slugged = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, available)
      .replace(/-+$/g, '')
    dedupeKey = prefix + slugged
  }

  // Dedupe BEFORE create — authorTaskProposal (taskPromotion.ts:44-50) via
  // findOpenByDedupeKey (taskProposal service:61-86): open means
  // pending|scanned, so a repeat sensing collapses onto a live proposal but
  // never a resolved (promoted/rejected) one. Org scoping there is the records
  // bridge's project scoping here.
  const existing = await records.query('task_proposals', {
    where: [
      { field: 'dedupeKey', op: 'eq', value: dedupeKey },
      { field: 'status', op: 'in', value: ['pending', 'scanned'] },
    ],
  })
  if (existing.length)
    return {
      ok: true,
      id: existing[0].id,
      status: existing[0].data.status,
      findings: [],
      deduped: true,
    }

  // Fail-closed scan at authoring time — authorTaskProposal
  // (taskPromotion.ts:52-53): pass → status scanned; fail → the row IS still
  // created with status rejected (never silently skipped).
  const verdict = await scan.content({
    title: title,
    description: description,
    evidence: evidence,
    sourceSignal: sourceSignal,
  })
  const status = verdict.passed ? 'scanned' : 'rejected'

  // Provenance meta — persistTaskProposals (executor.ts:696) prefers the
  // platform meta over input meta (authorTaskProposal: meta ?? input.meta ?? null).
  const meta = caller.scheduleId
    ? { scheduleId: caller.scheduleId }
    : args.meta && typeof args.meta === 'object' && !Array.isArray(args.meta)
      ? args.meta
      : null

  // Create — authorTaskProposal (taskPromotion.ts:55-71) field-for-field; the
  // sensing agent is the trusted caller (proposedByAgentId <- caller.agentId).
  const created = await records.upsert('task_proposals', {
    data: {
      title: title,
      description: description,
      priority: priority,
      evidence: evidence,
      sourceSignal: sourceSignal,
      dedupeKey: dedupeKey,
      repos: Array.isArray(args.repos)
        ? args.repos.filter((r) => typeof r === 'string')
        : [],
      parentId:
        typeof args.parentId === 'string' && args.parentId.trim()
          ? args.parentId.trim()
          : null,
      initiative:
        typeof args.initiative === 'string' && args.initiative.trim()
          ? args.initiative.trim()
          : null,
      status: status,
      scanResult: verdict,
      reason: verdict.passed
        ? null
        : 'Security scan failed: ' + verdict.findings.join('; '),
      meta: meta,
      proposedByAgentId: caller.agentId,
    },
  })
  return {
    ok: true,
    id: created.id,
    status: status,
    findings: verdict.findings,
    deduped: false,
  }
}
`

/** Seed record for the `proposeTask` Function (stable id — idempotent reconcile). */
export const ProposeTaskFunctionDef = {
  id: `fn_tpropos`,
  name: `proposeTask`,
  description: `Propose a self-sensed dev-loop task: dedupes by dedupeKey against still-open (pending|scanned) proposals, then runs the fail-closed content scan — pass creates a scanned row, fail still creates a rejected row. Replaces the hard-coded persistTaskProposals/authorTaskProposal handler.`,
  language: EFunLanguage.javascript,
  content: ProposeTaskFunctionSource,
}

import { EFunLanguage } from '@tdsk/domain'

/**
 * `devAddTask` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * CTO grooming: upserts a new backlog `dev_tasks` record. `createdBy` is
 * ALWAYS the platform-injected caller (a disagreeing createdBy arg is
 * refused). Dedupes against still-open tasks (any non-terminal state) on TWO
 * keys so an hourly grooming agenda can never stack duplicates: an identical
 * title, AND the same `sourceTaskProposalId` — so re-grooming a not-yet-
 * promoted proposal (even decomposed into a fresh title) never re-creates a
 * dev_task. Priority is coerced into P0-P3 (default P3, the dev-loop convention).
 */
export const DevAddTaskFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  if (typeof args.createdBy === 'string' && args.createdBy && args.createdBy !== caller.agentId)
    return { ok: false, reason: 'createdBy mismatch: the platform-injected caller identity is authoritative' }
  if (typeof args.agentId === 'string' && args.agentId && args.agentId !== caller.agentId)
    return { ok: false, reason: 'agentId mismatch: the platform-injected caller identity is authoritative' }

  const title = typeof args.title === 'string' ? args.title.trim() : ''
  const description = typeof args.description === 'string' ? args.description.trim() : ''
  if (!title || !description) return { ok: false, reason: 'title and description are required' }

  const priority = ['P0', 'P1', 'P2', 'P3'].includes(args.priority) ? args.priority : 'P3'
  const evidence = typeof args.evidence === 'string' && args.evidence.trim() ? args.evidence.trim() : null
  const sourceTaskProposalId =
    typeof args.sourceTaskProposalId === 'string' && args.sourceTaskProposalId.trim()
      ? args.sourceTaskProposalId.trim()
      : null

  const openStates = ['backlog', 'claimed', 'pr_open', 'in_review', 'approved', 'changes_requested']

  // Dedupe: an identical title on any still-open task means this is already
  // on the board — return it instead of stacking a duplicate.
  const open = await records.query('dev_tasks', {
    where: [
      { field: 'title', op: 'eq', value: title },
      { field: 'state', op: 'in', value: openStates },
    ],
    limit: 1,
  })
  if (open.length) return { ok: true, added: false, deduped: true, id: open[0].id }

  // Dedupe: a still-open task already carrying THIS sourceTaskProposalId means
  // the proposal was already groomed (decomposition gives new titles, so the
  // title dedupe above cannot catch it) — return the existing task instead of
  // re-grooming an unpromoted proposal every cycle.
  if (sourceTaskProposalId) {
    const sourced = await records.query('dev_tasks', {
      where: [
        { field: 'sourceTaskProposalId', op: 'eq', value: sourceTaskProposalId },
        { field: 'state', op: 'in', value: openStates },
      ],
      limit: 1,
    })
    if (sourced.length) return { ok: true, added: false, deduped: true, id: sourced[0].id }
  }

  const created = await records.upsert('dev_tasks', {
    data: {
      title: title,
      description: description,
      state: 'backlog',
      priority: priority,
      assignee: null,
      reviewer: null,
      leaseExpiresAt: null,
      claimedAt: null,
      prNumber: null,
      prUrl: null,
      branch: null,
      headSha: null,
      evidence: evidence,
      sourceTaskProposalId: sourceTaskProposalId,
      notes: null,
      history: [{ at: new Date().toISOString(), from: null, to: 'backlog', by: caller.agentId }],
      createdBy: caller.agentId,
    },
  })
  return { ok: true, added: true, id: created.id, state: 'backlog' }
}
`

/** Seed record for the `devAddTask` Function (stable id — idempotent reconcile). */
export const DevAddTaskFunctionDef = {
  id: `fn_dvaddtk`,
  name: `devAddTask`,
  description: `Groom the dev-team backlog: upsert a new backlog dev_tasks record ({title, description, priority P0-P3, evidence, sourceTaskProposalId}) with createdBy stamped from the platform-injected caller. Dedupes against still-open tasks on exact title AND on sourceTaskProposalId so repeated grooming of an unpromoted proposal never stacks duplicates.`,
  language: EFunLanguage.javascript,
  content: DevAddTaskFunctionSource,
}

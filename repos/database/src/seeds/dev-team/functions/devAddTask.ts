import { EFunLanguage } from '@tdsk/domain'

/**
 * `devAddTask` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * CTO grooming: upserts a new backlog `dev_tasks` record. `createdBy` is
 * ALWAYS the platform-injected caller (a disagreeing createdBy arg is
 * refused). Dedupes on exact title against still-open tasks (any non-terminal
 * state) so an hourly grooming agenda can never stack duplicates. Priority is
 * coerced into P0-P3 (default P3, the dev-loop convention).
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

  // Dedupe: an identical title on any still-open task means this is already
  // on the board — return it instead of stacking a duplicate.
  const open = await records.query('dev_tasks', {
    where: [
      { field: 'title', op: 'eq', value: title },
      { field: 'state', op: 'in', value: ['backlog', 'claimed', 'pr_open', 'in_review', 'approved', 'changes_requested'] },
    ],
    limit: 1,
  })
  if (open.length) return { ok: true, added: false, deduped: true, id: open[0].id }

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
  description: `Groom the dev-team backlog: upsert a new backlog dev_tasks record ({title, description, priority P0-P3, evidence}) with createdBy stamped from the platform-injected caller. Dedupes on exact title against still-open tasks so repeated grooming never stacks duplicates.`,
  language: EFunLanguage.javascript,
  content: DevAddTaskFunctionSource,
}

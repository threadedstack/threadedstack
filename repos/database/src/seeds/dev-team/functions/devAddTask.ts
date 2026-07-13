import { EFunLanguage } from '@tdsk/domain'

/**
 * `devAddTask` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * CTO grooming, ATOMIC groom-and-claim: upserts a new backlog `dev_tasks`
 * record AND, when the task carries a `sourceTaskProposalId`, promotes that
 * `task_proposals` row in the SAME call (folding in pickupTask's promotion
 * logic) via the `context.taskProposals` bridge — the authoritative SQL table,
 * never `context.records` (which only reaches the tenant's own Collections and
 * would leave the real table's status stuck at `scanned`, silently reappearing
 * on the next Collection backfill) — so a groomed proposal can NEVER stay
 * `scanned`. `createdBy` is ALWAYS the platform-injected caller (a disagreeing
 * createdBy arg is refused). Dedupes against still-open tasks (any non-terminal
 * state) on TWO keys so an hourly grooming agenda can never stack duplicates:
 * an identical title, AND the same `sourceTaskProposalId` — so re-grooming a
 * not-yet-promoted proposal (even decomposed into a fresh title) never
 * re-creates a dev_task. A dedupe HIT still promotes the source proposal — the
 * belt that closes the "dev_task merged, proposal still scanned, re-groomed
 * forever" hole. Priority is coerced into P0-P3 (default P3, the dev-loop
 * convention).
 */
export const DevAddTaskFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records
  const taskProposals = context.taskProposals

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

  // Fold in pickupTask's promotion logic: when a dev_task carries a source
  // proposal, mark that proposal promoted in THIS call so it can never stay
  // scanned — the dev_task (not a PR) is the anchor. task_proposals is the
  // platform's AUTHORITATIVE SQL table, not a project Collection, so this goes
  // through the taskProposals bridge (never context.records — a Collection
  // write there only patches a best-effort mirror that a later table->collection
  // backfill can silently reset back to scanned). This is a BEST-EFFORT
  // secondary effect: a missing bridge, a missing/already-terminal proposal, or
  // any error here, never fails the primary dev_task outcome.
  const promoteSourceProposal = async () => {
    if (!sourceTaskProposalId || !taskProposals) return
    try {
      await taskProposals.promote(sourceTaskProposalId, 'groomed into dev_tasks')
    } catch (err) {
      // Best-effort: the dev_task creation is the primary outcome. Swallow any
      // error so a proposal-promotion failure never fails devAddTask.
    }
  }

  const openStates = ['backlog', 'claimed', 'pr_open', 'in_review', 'approved', 'changes_requested']

  // Dedupe: an identical title on any still-open task means this is already
  // on the board — return it instead of stacking a duplicate. Even on a
  // dedupe HIT, still claim the source proposal (the belt that closes the
  // "dev_task merged, proposal still scanned" hole).
  const open = await records.query('dev_tasks', {
    where: [
      { field: 'title', op: 'eq', value: title },
      { field: 'state', op: 'in', value: openStates },
    ],
    limit: 1,
  })
  if (open.length) {
    await promoteSourceProposal()
    return { ok: true, added: false, deduped: true, id: open[0].id }
  }

  // Dedupe: a still-open task already carrying THIS sourceTaskProposalId means
  // the proposal was already groomed (decomposition gives new titles, so the
  // title dedupe above cannot catch it) — return the existing task instead of
  // re-grooming an unpromoted proposal every cycle. Still claim the proposal.
  if (sourceTaskProposalId) {
    const sourced = await records.query('dev_tasks', {
      where: [
        { field: 'sourceTaskProposalId', op: 'eq', value: sourceTaskProposalId },
        { field: 'state', op: 'in', value: openStates },
      ],
      limit: 1,
    })
    if (sourced.length) {
      await promoteSourceProposal()
      return { ok: true, added: false, deduped: true, id: sourced[0].id }
    }
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
  await promoteSourceProposal()
  return { ok: true, added: true, id: created.id, state: 'backlog' }
}
`

/** Seed record for the `devAddTask` Function (stable id — idempotent reconcile). */
export const DevAddTaskFunctionDef = {
  id: `fn_dvaddtk`,
  name: `devAddTask`,
  description: `Groom the dev-team backlog, atomic groom-and-claim: upsert a new backlog dev_tasks record ({title, description, priority P0-P3, evidence, sourceTaskProposalId}) with createdBy stamped from the platform-injected caller AND, when sourceTaskProposalId is set, promote that task_proposals row (status promoted + auditVerdict, prUrl null since the dev_task is the anchor) in the SAME call via the context.taskProposals bridge (the authoritative table, not the Collection mirror) so a groomed proposal can never stay scanned. Dedupes against still-open tasks on exact title AND on sourceTaskProposalId so repeated grooming of an unpromoted proposal never stacks duplicates; a dedupe hit still promotes the source proposal. The proposal promotion is best-effort (a missing bridge/proposal, an already-terminal proposal, or any error there, never fails the dev_task creation).`,
  language: EFunLanguage.javascript,
  content: DevAddTaskFunctionSource,
}

import { EFunLanguage } from '@tdsk/domain'

/**
 * `devUpdatePr` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * The author pushed a new commit while the task was under review or already
 * verdict-ed: cas `{state, assignee: caller}` → `{state:'pr_open', headSha,
 * reviewer: null, notes: ''}` for state in ('changes_requested', 'in_review',
 * 'approved') — guarded on the EXACT state read (mirrors devAbandon), so a
 * concurrent transition wins and this conflicts instead of clobbering it.
 * Clearing the reviewer voids the stale review claim and re-opens the review
 * race; the new headSha means any future verdict must bind to the fixed
 * commit (devCompleteReview refuses a stale sha, and devMarkMerged refuses a
 * stale sha too). Any pending verdict lease (the reviewer's in-progress
 * review, the reviewer's merge window) is nulled — `pr_open` is not a leased
 * state. This is what closes the loop devMarkMerged's headSha check opened:
 * without a live path to re-sync headSha after a post-approval push (e.g. a
 * merge-conflict resolution against a sibling task), a stale-approved record
 * could only recover via the 60-minute reaper instead of immediately.
 */
export const DevUpdatePrFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  if (typeof args.agentId === 'string' && args.agentId && args.agentId !== caller.agentId)
    return { ok: false, reason: 'agentId mismatch: the platform-injected caller identity is authoritative' }
  const agentId = caller.agentId

  const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : ''
  if (!taskId) return { ok: false, reason: 'taskId is required' }
  const headSha = typeof args.headSha === 'string' ? args.headSha.trim() : ''
  if (!headSha) return { ok: false, reason: 'headSha is required (the new head you pushed)' }

  const task = await records.get('dev_tasks', taskId)
  if (!task) return { ok: false, reason: 'task not found' }
  if (task.data.assignee !== agentId)
    return { ok: false, reason: 'you do not hold the work claim on this task' }

  const state = task.data.state
  const reopenable = state === 'changes_requested' || state === 'in_review' || state === 'approved'
  if (!reopenable)
    return { ok: true, updated: false, conflict: true, reason: 'task is not awaiting your fix (state: ' + state + ')' }

  const history = Array.isArray(task.data.history) ? task.data.history.slice(-99) : []
  history.push({ at: new Date().toISOString(), from: state, to: 'pr_open', by: agentId })

  // Guard on the EXACT state read (like devAbandon): a concurrent transition
  // (a reviewer's verdict landing, a reap) wins and this conflicts instead of
  // clobbering it.
  const res = await records.cas(
    'dev_tasks',
    taskId,
    { state: state, assignee: agentId },
    {
      state: 'pr_open',
      headSha: headSha,
      reviewer: null,
      notes: '',
      leaseExpiresAt: null,
      history: history,
    }
  )
  if (res.conflict)
    return { ok: true, updated: false, conflict: true, reason: 'task changed under you' }
  return { ok: true, updated: true, id: taskId, headSha: headSha }
}
`

/** Seed record for the `devUpdatePr` Function (stable id — idempotent reconcile). */
export const DevUpdatePrFunctionDef = {
  id: `fn_dvupdpr`,
  name: `devUpdatePr`,
  description: `Record a new push while the task is under review or already verdict-ed: atomic cas from changes_requested, in_review, OR approved → pr_open with the new headSha, clearing reviewer (the stale review/verdict is void) and notes. Only the recorded assignee (platform-injected caller) can update; guarded on the exact state read so a concurrent transition wins as a conflict; the task re-enters the review race with any pending verdict lease cleared.`,
  language: EFunLanguage.javascript,
  content: DevUpdatePrFunctionSource,
}

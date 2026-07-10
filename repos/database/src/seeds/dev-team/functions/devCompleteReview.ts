import { EFunLanguage } from '@tdsk/domain'

/**
 * `devCompleteReview` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * Records the review verdict: cas `{state:'in_review', reviewer: caller,
 * headSha}` → `{state: 'approved'|'changes_requested', notes}`. REFUSES unless
 * the caller is the recorded reviewer AND the `headSha` argument matches the
 * record's headSha — a new push voids the review (the verdict binds to the
 * exact commit the reviewer evaluated). `changes_requested` requires
 * actionable notes (the author's handoff). Both gates are platform-enforced
 * in the Function, not prompt discipline.
 *
 * BOTH verdicts carry a fresh now+60min lease — a verdict is an OBLIGATION,
 * never a parking state: `approved` puts the merge on the recorded reviewer's
 * clock, `changes_requested` puts the fix on the author's. If the owed action
 * never lands, devReapExpired recovers the task (approved → pr_open for a
 * fresh review, changes_requested → backlog for rework) instead of wedging.
 */
export const DevCompleteReviewFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  if (typeof args.agentId === 'string' && args.agentId && args.agentId !== caller.agentId)
    return { ok: false, reason: 'agentId mismatch: the platform-injected caller identity is authoritative' }
  const agentId = caller.agentId

  const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : ''
  if (!taskId) return { ok: false, reason: 'taskId is required' }

  const verdict = args.verdict
  if (verdict !== 'approved' && verdict !== 'changes_requested')
    return { ok: false, reason: 'invalid verdict: ' + String(verdict) + ' (approved | changes_requested)' }

  const headSha = typeof args.headSha === 'string' ? args.headSha.trim() : ''
  if (!headSha) return { ok: false, reason: 'headSha is required (the exact commit you reviewed)' }
  const notes = typeof args.notes === 'string' ? args.notes.trim() : ''
  if (verdict === 'changes_requested' && !notes)
    return { ok: false, reason: 'notes are required when requesting changes' }

  const task = await records.get('dev_tasks', taskId)
  if (!task) return { ok: false, reason: 'task not found' }

  // Platform-enforced verdict gates: only the recorded reviewer, only on the
  // exact commit reviewed.
  if (task.data.reviewer !== agentId)
    return { ok: false, reason: 'you are not the recorded reviewer on this task' }
  if (task.data.headSha !== headSha)
    return { ok: false, reason: 'headSha mismatch, a new push voided this review; re-review the current head' }

  if (task.data.state !== 'in_review')
    return { ok: true, completed: false, conflict: true, reason: 'task is not in review (state: ' + task.data.state + ')' }

  const now = Date.now()
  // The verdict lease: approved → the reviewer owes the merge, changes_requested
  // → the author owes the fix. Expiry hands the task to the reaper (approved →
  // pr_open re-review, changes_requested → backlog rework) — never a wedge.
  const leaseExpiresAt = now + 60 * 60 * 1000
  const history = Array.isArray(task.data.history) ? task.data.history.slice(-99) : []
  history.push({ at: new Date(now).toISOString(), from: 'in_review', to: verdict, by: agentId })

  const res = await records.cas(
    'dev_tasks',
    taskId,
    { state: 'in_review', reviewer: agentId, headSha: headSha },
    {
      state: verdict,
      notes: notes,
      leaseExpiresAt: leaseExpiresAt,
      history: history,
    }
  )
  if (res.conflict)
    return { ok: true, completed: false, conflict: true, reason: 'task changed under you (reaped or transitioned)' }
  return { ok: true, completed: true, id: taskId, state: verdict, leaseExpiresAt: leaseExpiresAt }
}
`

/** Seed record for the `devCompleteReview` Function (stable id — idempotent reconcile). */
export const DevCompleteReviewFunctionDef = {
  id: `fn_dvcmprv`,
  name: `devCompleteReview`,
  description: `Record the review verdict on an in_review dev_tasks record: atomic cas in_review → approved|changes_requested with notes and a fresh now+60min obligation lease (approved → the reviewer owes the merge, changes_requested → the author owes the fix; expiry hands the task to the reaper). REFUSES unless the caller is the recorded reviewer AND headSha matches the record (a new push voids the review). changes_requested requires actionable notes. Both gates are platform-enforced.`,
  language: EFunLanguage.javascript,
  content: DevCompleteReviewFunctionSource,
}

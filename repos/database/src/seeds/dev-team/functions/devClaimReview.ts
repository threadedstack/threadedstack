import { EFunLanguage } from '@tdsk/domain'

/**
 * `devClaimReview` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * Wins the REVIEW claim on an open PR: cas `{state:'pr_open', reviewer:null}` →
 * `{state:'in_review', reviewer: caller, leaseExpiresAt: now+20min}`.
 *
 * REVIEWER INDEPENDENCE IS PLATFORM-ENFORCED HERE, not by prompt discipline:
 * the Function REFUSES when the caller is the recorded assignee (an author
 * never reviews their own PR). The read assignee also rides the CAS guard, so
 * the independence check cannot be raced between the read and the write.
 */
export const DevClaimReviewFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  if (typeof args.agentId === 'string' && args.agentId && args.agentId !== caller.agentId)
    return { ok: false, reason: 'agentId mismatch: the platform-injected caller identity is authoritative' }
  const agentId = caller.agentId

  const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : ''
  if (!taskId) return { ok: false, reason: 'taskId is required' }

  const task = await records.get('dev_tasks', taskId)
  if (!task) return { ok: false, reason: 'task not found' }

  // THE independence gate: reviewer can never equal assignee. Enforced in the
  // Function (platform-mediated), and made race-safe by guarding the CAS on
  // the exact assignee read here.
  if (task.data.assignee === agentId)
    return { ok: false, reason: 'you authored this PR, an author never reviews their own work' }

  if (task.data.state !== 'pr_open')
    return { ok: true, claimed: false, conflict: true, reason: 'task is not awaiting review (state: ' + task.data.state + ')' }
  if (task.data.reviewer)
    return { ok: true, claimed: false, conflict: true, reason: 'another engineer already holds the review' }

  const assignee = typeof task.data.assignee === 'string' ? task.data.assignee : null
  const now = Date.now()
  const leaseExpiresAt = now + 20 * 60 * 1000
  const history = Array.isArray(task.data.history) ? task.data.history.slice(-99) : []
  history.push({ at: new Date(now).toISOString(), from: 'pr_open', to: 'in_review', by: agentId })

  const res = await records.cas(
    'dev_tasks',
    taskId,
    { state: 'pr_open', reviewer: null, assignee: assignee },
    {
      state: 'in_review',
      reviewer: agentId,
      leaseExpiresAt: leaseExpiresAt,
      history: history,
    }
  )
  if (res.conflict)
    return { ok: true, claimed: false, conflict: true, reason: 'another engineer won the review' }
  return { ok: true, claimed: true, id: taskId, headSha: task.data.headSha, leaseExpiresAt: leaseExpiresAt }
}
`

/** Seed record for the `devClaimReview` Function (stable id — idempotent reconcile). */
export const DevClaimReviewFunctionDef = {
  id: `fn_dvclrev`,
  name: `devClaimReview`,
  description: `Win the REVIEW claim on a pr_open dev_tasks record: atomic cas pr_open+reviewer:null → in_review with the caller as reviewer and a 20-minute renewable lease. REFUSES when the caller is the recorded assignee — reviewer independence is platform-enforced, race-safe via the assignee-guarded CAS. A lost race returns {conflict:true}.`,
  language: EFunLanguage.javascript,
  content: DevClaimReviewFunctionSource,
}

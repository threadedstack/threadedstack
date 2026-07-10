import { EFunLanguage } from '@tdsk/domain'

/**
 * `devRenewLease` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * Claim liveness: the holder renews its lease while working (about every 10
 * minutes) so the reaper never reclaims live work. Guarded on the holder's
 * role in the CURRENT state — `{state:'claimed', assignee: caller}` or
 * `{state:'in_review', reviewer: caller}` — so a reaped/transitioned task can
 * never be re-leased by a stale holder. NOT a state transition, so no history
 * entry is appended. The new lease is capped at now+60min (a runaway lease
 * would wedge the reaper).
 */
export const DevRenewLeaseFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  if (typeof args.agentId === 'string' && args.agentId && args.agentId !== caller.agentId)
    return { ok: false, reason: 'agentId mismatch: the platform-injected caller identity is authoritative' }
  const agentId = caller.agentId

  const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : ''
  if (!taskId) return { ok: false, reason: 'taskId is required' }

  const now = Date.now()
  const requested = typeof args.leaseExpiresAt === 'number' ? Math.floor(args.leaseExpiresAt) : NaN
  // Default 20-minute extension; an explicit future value is honored but
  // capped at 60 minutes out.
  const leaseExpiresAt = Number.isFinite(requested) && requested > now
    ? Math.min(requested, now + 60 * 60 * 1000)
    : now + 20 * 60 * 1000

  const task = await records.get('dev_tasks', taskId)
  if (!task) return { ok: false, reason: 'task not found' }

  let match = null
  if (task.data.state === 'claimed' && task.data.assignee === agentId)
    match = { state: 'claimed', assignee: agentId }
  else if (task.data.state === 'in_review' && task.data.reviewer === agentId)
    match = { state: 'in_review', reviewer: agentId }
  else return { ok: false, reason: 'no active lease held on this task (state: ' + task.data.state + ')' }

  const res = await records.cas('dev_tasks', taskId, match, { leaseExpiresAt: leaseExpiresAt })
  if (res.conflict)
    return { ok: true, renewed: false, conflict: true, reason: 'task changed under you (reaped or transitioned)' }
  return { ok: true, renewed: true, id: taskId, leaseExpiresAt: leaseExpiresAt }
}
`

/** Seed record for the `devRenewLease` Function (stable id — idempotent reconcile). */
export const DevRenewLeaseFunctionDef = {
  id: `fn_dvrenew`,
  name: `devRenewLease`,
  description: `Renew the caller's claim lease on a dev_tasks record it actively holds: atomic cas guarded on {state:'claimed', assignee} or {state:'in_review', reviewer}, patching leaseExpiresAt (default now+20min, capped at now+60min). Not a transition — no history entry. A reaped task returns {conflict:true}.`,
  language: EFunLanguage.javascript,
  content: DevRenewLeaseFunctionSource,
}

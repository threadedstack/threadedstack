import { EFunLanguage } from '@tdsk/domain'

/**
 * `devClaimTask` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * Wins the WORK claim on a backlog task: cas `{state:'backlog'}` →
 * `{state:'claimed', assignee, claimedAt, leaseExpiresAt: now+20min}`. The CAS
 * is the concurrency gate — two engineers racing the same task can never both
 * win; the loser gets `{conflict:true}` back as a NORMAL outcome, never an
 * error. Identity is the platform-injected `context.caller.agentId` (an
 * `agentId` arg that disagrees with it is refused). Appends a history entry
 * via read-then-cas, race-safe because the guard is on the changing `state`.
 */
export const DevClaimTaskFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  // Caller trust — the platform-injected identity is authoritative; a
  // disagreeing agentId arg is a spoof attempt and is refused.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  if (typeof args.agentId === 'string' && args.agentId && args.agentId !== caller.agentId)
    return { ok: false, reason: 'agentId mismatch: the platform-injected caller identity is authoritative' }
  const agentId = caller.agentId

  const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : ''
  if (!taskId) return { ok: false, reason: 'taskId is required' }

  const task = await records.get('dev_tasks', taskId)
  if (!task) return { ok: false, reason: 'task not found' }
  if (task.data.state !== 'backlog')
    return { ok: true, claimed: false, conflict: true, reason: 'task is not in backlog (state: ' + task.data.state + ')' }

  // SINGLE-CLAIM DISCIPLINE (platform-enforced): an engineer holds at most one
  // work claim at a time — take it to pr_open (or let the lease lapse) before
  // claiming another. The first live run showed watch-driven over-claiming
  // (one seat hoarding three tasks and switching between them); serial focus
  // ships PRs, hoarding starves the board. Review claims are separate and
  // unaffected. Best-effort read-then-refuse: a racing double-claim slips this
  // gate at worst rarely, and the reaper returns hoarded work regardless.
  const held = await records.query('dev_tasks', {
    where: [
      { field: 'assignee', op: 'eq', value: agentId },
      { field: 'state', op: 'eq', value: 'claimed' },
    ],
    limit: 1,
  })
  if (Array.isArray(held) && held.length > 0)
    return { ok: true, claimed: false, conflict: true, reason: 'you already hold a work claim (' + held[0].id + ') — take it to pr_open before claiming another task' }

  const now = Date.now()
  const leaseExpiresAt = now + 20 * 60 * 1000
  const history = Array.isArray(task.data.history) ? task.data.history.slice(-99) : []
  history.push({ at: new Date(now).toISOString(), from: 'backlog', to: 'claimed', by: agentId })

  // The atomic claim: exactly one concurrent caller wins the backlog->claimed
  // transition; the state guard also makes the history append race-safe.
  const res = await records.cas('dev_tasks', taskId, { state: 'backlog' }, {
    state: 'claimed',
    assignee: agentId,
    claimedAt: now,
    leaseExpiresAt: leaseExpiresAt,
    history: history,
  })
  if (res.conflict)
    return { ok: true, claimed: false, conflict: true, reason: 'another engineer won the claim' }
  return { ok: true, claimed: true, id: taskId, leaseExpiresAt: leaseExpiresAt }
}
`

/** Seed record for the `devClaimTask` Function (stable id — idempotent reconcile). */
export const DevClaimTaskFunctionDef = {
  id: `fn_dvclaim`,
  name: `devClaimTask`,
  description: `Win the WORK claim on a backlog dev_tasks record: atomic cas backlog → claimed with the caller as assignee and a 20-minute renewable lease. A lost race returns {conflict:true} as a normal outcome. Identity is the platform-injected caller — a disagreeing agentId arg is refused.`,
  language: EFunLanguage.javascript,
  content: DevClaimTaskFunctionSource,
}

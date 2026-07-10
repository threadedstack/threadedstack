import { EFunLanguage } from '@tdsk/domain'

/**
 * `devAbandon` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * The CTO lead's explicit close-out: cas any NON-TERMINAL state →
 * `{state:'abandoned', notes: reason, assignee/reviewer cleared}`. This is the
 * escape hatch for a task that is genuinely dead — superseded, invalid, or
 * unrecoverable after reap-and-reconcile — so no wedge state can strand a
 * record forever. The `reason` is REQUIRED and lands in `notes` as the
 * record's last word. Guarded on the EXACT state read, so a concurrent
 * transition (an engineer's claim, a review verdict) wins and the close-out
 * conflicts instead of clobbering live work. CTO-allowlist ONLY (the lead's
 * resident config carries it; the engineers' never do) — one owner per duty.
 */
export const DevAbandonFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  if (typeof args.agentId === 'string' && args.agentId && args.agentId !== caller.agentId)
    return { ok: false, reason: 'agentId mismatch: the platform-injected caller identity is authoritative' }
  const agentId = caller.agentId

  const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : ''
  if (!taskId) return { ok: false, reason: 'taskId is required' }
  const reason = typeof args.reason === 'string' ? args.reason.trim() : ''
  if (!reason) return { ok: false, reason: 'reason is required (the close-out is the record\\'s last word)' }

  const task = await records.get('dev_tasks', taskId)
  if (!task) return { ok: false, reason: 'task not found' }

  const state = task.data.state
  if (state === 'merged' || state === 'abandoned')
    return { ok: true, abandoned: false, conflict: true, reason: 'task is already terminal (state: ' + state + ')' }

  const history = Array.isArray(task.data.history) ? task.data.history.slice(-99) : []
  history.push({ at: new Date().toISOString(), from: state, to: 'abandoned', by: agentId })

  // Guard on the EXACT state read: a concurrent transition wins the record and
  // this close-out conflicts (a normal outcome) instead of clobbering it.
  const res = await records.cas('dev_tasks', taskId, { state: state }, {
    state: 'abandoned',
    notes: reason,
    assignee: null,
    reviewer: null,
    claimedAt: null,
    leaseExpiresAt: null,
    history: history,
  })
  if (res.conflict)
    return { ok: true, abandoned: false, conflict: true, reason: 'task changed under you (transitioned concurrently)' }
  return { ok: true, abandoned: true, id: taskId, state: 'abandoned' }
}
`

/** Seed record for the `devAbandon` Function (stable id — idempotent reconcile). */
export const DevAbandonFunctionDef = {
  id: `fn_dvabndn`,
  name: `devAbandon`,
  description: `Explicitly close out a dead dev_tasks record: atomic cas from any NON-terminal state → abandoned with the required reason in notes, clearing assignee/reviewer/lease. Guarded on the exact state read so a concurrent transition wins as {conflict:true}. CTO-lead allowlist only — the escape hatch that keeps every wedge state recoverable.`,
  language: EFunLanguage.javascript,
  content: DevAbandonFunctionSource,
}

import { EFunLanguage } from '@tdsk/domain'

/**
 * `devMarkMerged` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * The reviewer merged the approved PR (gh pr merge from its own VM) and closes
 * the loop: cas `{state:'approved', reviewer: caller}` → `{state:'merged'}`.
 * Only the recorded reviewer — the seat whose approved verdict is on the
 * record — can mark the merge; that pairing (recorded verdict + reviewer-run
 * merge) is the independence gate, since both engineers share one GitHub
 * account identity and GitHub's own approval UI cannot arbitrate.
 */
export const DevMarkMergedFunctionSource = `export default async (request, context) => {
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
  if (task.data.reviewer !== agentId)
    return { ok: false, reason: 'only the recorded reviewer marks a task merged' }
  if (task.data.state !== 'approved')
    return { ok: true, merged: false, conflict: true, reason: 'task is not approved (state: ' + task.data.state + ')' }

  const history = Array.isArray(task.data.history) ? task.data.history.slice(-99) : []
  history.push({ at: new Date().toISOString(), from: 'approved', to: 'merged', by: agentId })

  const res = await records.cas('dev_tasks', taskId, { state: 'approved', reviewer: agentId }, {
    state: 'merged',
    leaseExpiresAt: null,
    history: history,
  })
  if (res.conflict)
    return { ok: true, merged: false, conflict: true, reason: 'task changed under you' }
  return { ok: true, merged: true, id: taskId }
}
`

/** Seed record for the `devMarkMerged` Function (stable id — idempotent reconcile). */
export const DevMarkMergedFunctionDef = {
  id: `fn_dvmerge`,
  name: `devMarkMerged`,
  description: `Close the loop after the reviewer merges the approved PR: atomic cas approved → merged. Only the recorded reviewer (platform-injected caller) can mark the merge — the recorded verdict + reviewer-run merge is the independence gate, since GitHub's approval UI cannot arbitrate a shared account.`,
  language: EFunLanguage.javascript,
  content: DevMarkMergedFunctionSource,
}

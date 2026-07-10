import { EFunLanguage } from '@tdsk/domain'

/**
 * `devUpdatePr` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * The author pushed a fix after changes were requested: cas
 * `{state:'changes_requested', assignee: caller}` → `{state:'pr_open',
 * headSha, reviewer: null, notes: ''}`. Clearing the reviewer voids the stale
 * review claim and re-opens the review race; the new headSha means any verdict
 * must bind to the fixed commit (devCompleteReview refuses a stale sha).
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
  if (task.data.state !== 'changes_requested')
    return { ok: true, updated: false, conflict: true, reason: 'task is not awaiting your fix (state: ' + task.data.state + ')' }

  const history = Array.isArray(task.data.history) ? task.data.history.slice(-99) : []
  history.push({ at: new Date().toISOString(), from: 'changes_requested', to: 'pr_open', by: agentId })

  const res = await records.cas(
    'dev_tasks',
    taskId,
    { state: 'changes_requested', assignee: agentId },
    {
      state: 'pr_open',
      headSha: headSha,
      reviewer: null,
      notes: '',
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
  description: `Record the author's fix push after changes_requested: atomic cas changes_requested → pr_open with the new headSha, clearing reviewer (the stale review is void) and notes. Only the recorded assignee (platform-injected caller) can update; the task re-enters the review race.`,
  language: EFunLanguage.javascript,
  content: DevUpdatePrFunctionSource,
}

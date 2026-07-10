import { EFunLanguage } from '@tdsk/domain'

/**
 * `devSubmitPr` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * The author opened the PR: cas `{state:'claimed', assignee: caller}` →
 * `{state:'pr_open', prNumber, prUrl, branch, headSha, leaseExpiresAt: null}`.
 * The recorded `headSha` is what a later review binds to (a new push voids the
 * review). The work lease is nulled — `pr_open` is not a leased state (the
 * review claim carries its own lease). Only the recorded assignee can submit;
 * a lost race returns `{conflict:true}` as a normal outcome.
 */
export const DevSubmitPrFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  if (typeof args.agentId === 'string' && args.agentId && args.agentId !== caller.agentId)
    return { ok: false, reason: 'agentId mismatch: the platform-injected caller identity is authoritative' }
  const agentId = caller.agentId

  const taskId = typeof args.taskId === 'string' ? args.taskId.trim() : ''
  if (!taskId) return { ok: false, reason: 'taskId is required' }

  const prNumber = typeof args.prNumber === 'number' ? Math.floor(args.prNumber) : parseInt(args.prNumber, 10)
  if (!Number.isInteger(prNumber) || prNumber <= 0)
    return { ok: false, reason: 'prNumber must be a positive integer' }
  const prUrl = typeof args.prUrl === 'string' ? args.prUrl.trim() : ''
  const branch = typeof args.branch === 'string' ? args.branch.trim() : ''
  const headSha = typeof args.headSha === 'string' ? args.headSha.trim() : ''
  if (!prUrl || !branch || !headSha)
    return { ok: false, reason: 'prUrl, branch and headSha are required' }

  const task = await records.get('dev_tasks', taskId)
  if (!task) return { ok: false, reason: 'task not found' }
  // Identity gate is platform-mediated, never prompt discipline: only the
  // engineer holding the work claim can attach a PR to it.
  if (task.data.assignee !== agentId)
    return { ok: false, reason: 'you do not hold the work claim on this task' }
  if (task.data.state !== 'claimed')
    return { ok: true, submitted: false, conflict: true, reason: 'task is not claimed (state: ' + task.data.state + ')' }

  const history = Array.isArray(task.data.history) ? task.data.history.slice(-99) : []
  history.push({ at: new Date().toISOString(), from: 'claimed', to: 'pr_open', by: agentId })

  const res = await records.cas('dev_tasks', taskId, { state: 'claimed', assignee: agentId }, {
    state: 'pr_open',
    prNumber: prNumber,
    prUrl: prUrl,
    branch: branch,
    headSha: headSha,
    leaseExpiresAt: null,
    history: history,
  })
  if (res.conflict)
    return { ok: true, submitted: false, conflict: true, reason: 'task changed under you (reaped or transitioned)' }
  return { ok: true, submitted: true, id: taskId, prNumber: prNumber, headSha: headSha }
}
`

/** Seed record for the `devSubmitPr` Function (stable id — idempotent reconcile). */
export const DevSubmitPrFunctionDef = {
  id: `fn_dvsubpr`,
  name: `devSubmitPr`,
  description: `Record the author's opened PR on a claimed dev_tasks record: atomic cas claimed → pr_open with prNumber/prUrl/branch/headSha, nulling the work lease. The recorded headSha is what a review binds to. Only the recorded assignee (platform-injected caller) can submit; a lost race returns {conflict:true}.`,
  language: EFunLanguage.javascript,
  content: DevSubmitPrFunctionSource,
}

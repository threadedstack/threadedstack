import { EFunLanguage } from '@tdsk/domain'

/**
 * `devReapExpired` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * The lease reaper (a CTO agenda duty): queries `dev_tasks` whose
 * `leaseExpiresAt` passed while `state` is `claimed` or `in_review`, and
 * CAS-reclaims each one guarded on the EXACT leaseExpiresAt it read — a
 * concurrent `devRenewLease` changes that value, so a live holder always wins
 * and the reap conflicts instead of clobbering. Reclaims: `claimed` →
 * `backlog` (assignee/claimedAt cleared), `in_review` → `pr_open` (reviewer
 * cleared).
 *
 * NO GitHub calls from the isolate: the Function returns the `reaped` +
 * `candidates` lists (with prNumber/prUrl/branch/headSha anchors) and the CTO
 * — which runs this and HAS gh in its VM — reconciles them against real
 * GitHub state per its prompt.
 *
 * The `lt` comparison on leaseExpiresAt rides the record query API's text
 * compare of `data ->> field`; every lease is an epoch-ms integer (13 digits
 * until 2286), so equal-width digit strings compare numerically. A null or
 * absent lease compares as SQL NULL and never matches.
 */
export const DevReapExpiredFunctionSource = `export default async (request, context) => {
  const caller = context.caller || {}
  const records = context.records

  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  const agentId = caller.agentId

  const now = Date.now()
  const expired = await records.query('dev_tasks', {
    where: [
      { field: 'state', op: 'in', value: ['claimed', 'in_review'] },
      { field: 'leaseExpiresAt', op: 'lt', value: now },
    ],
    limit: 100,
  })

  const reaped = []
  const conflicts = []
  const candidates = []

  for (const task of expired) {
    const lease = task.data.leaseExpiresAt
    const fromClaimed = task.data.state === 'claimed'
    const to = fromClaimed ? 'backlog' : 'pr_open'

    // Every expired task is a candidate the CTO reconciles against GitHub
    // (gh pr view / gh pr list) before or after the reclaim.
    candidates.push({
      id: task.id,
      title: task.data.title,
      state: task.data.state,
      assignee: task.data.assignee || null,
      reviewer: task.data.reviewer || null,
      prNumber: task.data.prNumber || null,
      prUrl: task.data.prUrl || null,
      branch: task.data.branch || null,
      headSha: task.data.headSha || null,
      leaseExpiresAt: lease,
    })

    const history = Array.isArray(task.data.history) ? task.data.history.slice(-99) : []
    history.push({ at: new Date(now).toISOString(), from: task.data.state, to: to, by: agentId })

    // Guard on the EXACT lease read: a concurrent renewal changed it, so the
    // holder wins and this reap conflicts (a normal outcome).
    const match = fromClaimed
      ? { state: 'claimed', leaseExpiresAt: lease }
      : { state: 'in_review', leaseExpiresAt: lease }
    const patch = fromClaimed
      ? { state: 'backlog', assignee: null, claimedAt: null, leaseExpiresAt: null, history: history }
      : { state: 'pr_open', reviewer: null, leaseExpiresAt: null, history: history }

    const res = await records.cas('dev_tasks', task.id, match, patch)
    if (res.conflict) conflicts.push(task.id)
    else
      reaped.push({
        id: task.id,
        title: task.data.title,
        from: task.data.state,
        to: to,
        holder: fromClaimed ? task.data.assignee || null : task.data.reviewer || null,
        prNumber: task.data.prNumber || null,
        prUrl: task.data.prUrl || null,
        branch: task.data.branch || null,
      })
  }

  return { ok: true, reaped: reaped, conflicts: conflicts, candidates: candidates }
}
`

/** Seed record for the `devReapExpired` Function (stable id — idempotent reconcile). */
export const DevReapExpiredFunctionDef = {
  id: `fn_dvreapx`,
  name: `devReapExpired`,
  description: `Reap expired dev_tasks leases: query leaseExpiresAt < now in state claimed|in_review, then CAS-reclaim each guarded on the EXACT lease read (a concurrent renewal always wins) — claimed → backlog, in_review → pr_open. Never touches GitHub; returns reaped + candidates (with PR anchors) for the CTO to reconcile via gh in its VM.`,
  language: EFunLanguage.javascript,
  content: DevReapExpiredFunctionSource,
}

import { EFunLanguage } from '@tdsk/domain'

/**
 * `devReapExpired` — dev-team effect Function (realtime engineering team, Phase 2).
 *
 * The lease reaper (a CTO agenda duty): queries `dev_tasks` whose
 * `leaseExpiresAt` passed while `state` is any of the four LEASED states, and
 * CAS-reclaims each one guarded on the EXACT leaseExpiresAt it read — a
 * concurrent `devRenewLease` changes that value, so a live holder always wins
 * and the reap conflicts instead of clobbering. Reclaims:
 *   claimed           → backlog  (assignee/claimedAt cleared — re-claim)
 *   in_review         → pr_open  (reviewer cleared — re-review)
 *   approved          → pr_open  (reviewer cleared — the merge never landed,
 *                                 so the task re-enters the review race)
 *   changes_requested → backlog  (assignee AND reviewer cleared — the fix
 *                                 never landed, so the task goes back to rework)
 * Every reclaim appends a history entry; PR anchors (prNumber/prUrl/branch/
 * headSha) always survive so a re-claimer never rebuilds from scratch.
 *
 * NO GitHub calls from the isolate: the Function returns the `reaped` +
 * `candidates` lists (with PR anchors) and the CTO — which runs this and HAS
 * gh in its VM — reconciles them against real GitHub state per its prompt.
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
      { field: 'state', op: 'in', value: ['claimed', 'in_review', 'approved', 'changes_requested'] },
      { field: 'leaseExpiresAt', op: 'lt', value: now },
    ],
    limit: 100,
  })

  // Per-state reclaim map: where an expired holder's task goes, and which
  // holder fields the reclaim clears. PR anchors always survive.
  const reclaims = {
    claimed: { to: 'backlog', patch: { state: 'backlog', assignee: null, claimedAt: null, leaseExpiresAt: null } },
    in_review: { to: 'pr_open', patch: { state: 'pr_open', reviewer: null, leaseExpiresAt: null } },
    approved: { to: 'pr_open', patch: { state: 'pr_open', reviewer: null, leaseExpiresAt: null } },
    changes_requested: { to: 'backlog', patch: { state: 'backlog', assignee: null, reviewer: null, claimedAt: null, leaseExpiresAt: null } },
  }

  const reaped = []
  const conflicts = []
  const candidates = []

  for (const task of expired) {
    const lease = task.data.leaseExpiresAt
    const state = task.data.state
    const reclaim = reclaims[state]
    if (!reclaim) continue
    // The holder that owed the expired action: the assignee owes work
    // (claimed) and fixes (changes_requested); the reviewer owes the review
    // (in_review) and the merge (approved).
    const holder = state === 'claimed' || state === 'changes_requested'
      ? task.data.assignee || null
      : task.data.reviewer || null

    // Every expired task is a candidate the CTO reconciles against GitHub
    // (gh pr view / gh pr list) before or after the reclaim.
    candidates.push({
      id: task.id,
      title: task.data.title,
      state: state,
      assignee: task.data.assignee || null,
      reviewer: task.data.reviewer || null,
      prNumber: task.data.prNumber || null,
      prUrl: task.data.prUrl || null,
      branch: task.data.branch || null,
      headSha: task.data.headSha || null,
      leaseExpiresAt: lease,
    })

    const history = Array.isArray(task.data.history) ? task.data.history.slice(-99) : []
    history.push({ at: new Date(now).toISOString(), from: state, to: reclaim.to, by: agentId })

    // Guard on the EXACT lease read: a concurrent renewal changed it, so the
    // holder wins and this reap conflicts (a normal outcome).
    const res = await records.cas(
      'dev_tasks',
      task.id,
      { state: state, leaseExpiresAt: lease },
      Object.assign({}, reclaim.patch, { history: history })
    )
    if (res.conflict) conflicts.push(task.id)
    else
      reaped.push({
        id: task.id,
        title: task.data.title,
        from: state,
        to: reclaim.to,
        holder: holder,
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
  description: `Reap expired dev_tasks leases: query leaseExpiresAt < now across all four leased states, then CAS-reclaim each guarded on the EXACT lease read (a concurrent renewal always wins) — claimed → backlog, in_review → pr_open, approved → pr_open (re-review), changes_requested → backlog (rework). PR anchors survive every reclaim. Never touches GitHub; returns reaped + candidates (with PR anchors) for the CTO to reconcile via gh in its VM.`,
  language: EFunLanguage.javascript,
  content: DevReapExpiredFunctionSource,
}

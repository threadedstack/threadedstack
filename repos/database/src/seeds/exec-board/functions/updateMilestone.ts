import { EFunLanguage } from '@tdsk/domain'

/**
 * `updateMilestone` — board effect Function (long-term planning system).
 *
 * The progress-tracking write: locates a plan by record id, patches the named
 * milestone (status — with `completedAt` stamped automatically the moment the
 * status becomes `done` — and appended evidence, capped at the most recent
 * 20 refs), and optionally advances the plan's keyResults `current` values
 * matched by metric. Everything else on the plan is preserved untouched, so
 * progress updates never clobber the plan body the way a whole-array
 * `upsertPlan` milestones patch would.
 *
 * Caller gate is the ⑤a board-member pattern (saveMarketingArtifact): any
 * board member may report progress — the CTO reports execution progress on
 * plans it does not own — resolved from the trusted platform-injected
 * `context.caller`, never from model-emitted args.
 */
export const UpdateMilestoneFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  // Board-member gate — any seat may report progress (the CTO reports
  // execution progress on plans it does not own), via the trusted caller.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  const members = await records.query('board_members', {
    where: [{ field: 'agentId', op: 'eq', value: caller.agentId }],
  })
  if (!members.length) return { ok: false, reason: 'caller is not a board member' }

  const MilestoneEvidenceMax = 20
  const validMilestoneStatuses = ['open', 'in-progress', 'done']

  const planId = typeof args.planId === 'string' ? args.planId.trim() : ''
  const milestoneTitle =
    typeof args.milestoneTitle === 'string' ? args.milestoneTitle.trim() : ''
  if (!planId || !milestoneTitle)
    return { ok: false, reason: 'planId and milestoneTitle are required' }

  const status = args.status
  if (status !== undefined && validMilestoneStatuses.indexOf(status) === -1)
    return { ok: false, reason: 'invalid status: ' + status }
  // Evidence: a string or an array of strings, appended (never replaced).
  const evidence = (
    Array.isArray(args.evidence)
      ? args.evidence
      : typeof args.evidence === 'string'
        ? [args.evidence]
        : []
  ).filter((ref) => typeof ref === 'string' && ref.trim())
  // KR progress: lenient-parsed [{metric, current}] entries; malformed dropped.
  const current = (Array.isArray(args.current) ? args.current : []).filter(
    (kr) =>
      kr &&
      typeof kr === 'object' &&
      typeof kr.metric === 'string' &&
      kr.metric.trim() &&
      kr.current !== undefined
  )
  if (status === undefined && !evidence.length && !current.length)
    return { ok: false, reason: 'nothing to update: pass status, current, or evidence' }

  const plan = await records.get('plans', planId)
  if (!plan) return { ok: false, reason: 'plan not found: ' + planId }

  const milestones = Array.isArray(plan.data.milestones) ? plan.data.milestones : []
  const key = milestoneTitle.toLowerCase()
  const milestone = milestones.find(
    (ms) => ms && typeof ms.title === 'string' && ms.title.trim().toLowerCase() === key
  )
  if (!milestone) return { ok: false, reason: 'milestone not found: ' + milestoneTitle }

  // Patch the named milestone: completedAt is stamped automatically the moment
  // the status becomes done (an already-set stamp is preserved).
  if (status !== undefined) {
    milestone.status = status
    if (status === 'done' && !milestone.completedAt)
      milestone.completedAt = new Date().toISOString()
  }
  if (evidence.length) {
    const merged = (Array.isArray(milestone.evidence) ? milestone.evidence : []).concat(
      evidence
    )
    milestone.evidence = merged.slice(-MilestoneEvidenceMax)
  }

  // Optionally advance the plan's keyResults current values, matched by metric.
  let keyResultsUpdated = 0
  if (current.length) {
    const keyResults = Array.isArray(plan.data.keyResults) ? plan.data.keyResults : []
    for (const entry of current) {
      const metric = entry.metric.trim().toLowerCase()
      const kr = keyResults.find(
        (item) =>
          item &&
          typeof item.metric === 'string' &&
          item.metric.trim().toLowerCase() === metric
      )
      if (kr) {
        kr.current = entry.current
        keyResultsUpdated++
      }
    }
  }

  // The write records its author — the board Functions' updatedByAgentId convention.
  plan.data.updatedByAgentId = caller.agentId
  const saved = await records.upsert('plans', { id: plan.id, data: plan.data })
  return {
    ok: true,
    updated: true,
    planId: saved.id,
    milestone: milestone.title,
    completedAt: milestone.completedAt || null,
    keyResultsUpdated: keyResultsUpdated,
  }
}
`

/** Seed record for the `updateMilestone` Function (stable id — idempotent reconcile). */
export const UpdateMilestoneFunctionDef = {
  id: `fn_bmile01`,
  name: `updateMilestone`,
  description: `Report progress on a board plan: patches the named milestone (status open|in-progress|done — completedAt stamped automatically when it becomes done; evidence strings appended, capped at 20) and optionally advances keyResults current values matched by metric. Caller must hold a board_members record; any seat may report progress.`,
  language: EFunLanguage.javascript,
  content: UpdateMilestoneFunctionSource,
}

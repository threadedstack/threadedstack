import { EFunLanguage } from '@tdsk/domain'

/**
 * `upsertPlan` — board effect Function (long-term planning system).
 *
 * Creates or patches a `plans` record — the board's long-term planning surface
 * (goals, estimations, milestones, progress) — via the ① `records` capability.
 * An explicit `id` arg patches that plan in place; otherwise the (kind, trimmed
 * lowercase title) pair is the dedupe key (the saveMarketingArtifact
 * convention). Patch semantics mirror `upsertStrategy`: ONLY recognized,
 * correctly-typed fields land, last-write-wins per field, untouched fields are
 * preserved; `objective`/`notes` cap at ~4000 chars (truncated, never
 * rejected). `keyResults`/`milestones` are lenient-parsed arrays of objects —
 * entries missing their required subfields (metric+target / title+valid
 * status) are dropped, mirroring the upsertStrategy backlog filter.
 *
 * Caller gate is the ⑤a board-member pattern PLUS a role-vs-owner lane check:
 * the trusted platform-injected `context.caller` must hold a `board_members`
 * record, and that record's ROLE gates the effective owner+kind — the CEO may
 * write any plan, the CMO only cmo-owned `gtm` plans, the CTO only cto-owned
 * `initiative` plans. The check runs on the EFFECTIVE post-patch record, so a
 * patch can never move a plan out of the caller's lane, and a non-CEO can
 * never touch another seat's plan through here.
 */
export const UpsertPlanFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  // Board-member gate — the ⑤a caller-gate pattern; the member's role also
  // drives the owner/kind lane validation below.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  const members = await records.query('board_members', {
    where: [{ field: 'agentId', op: 'eq', value: caller.agentId }],
  })
  const member = members[0]
  if (!member) return { ok: false, reason: 'caller is not a board member' }
  const role = typeof member.data.role === 'string' ? member.data.role : ''

  const TextMaxChars = 4000
  const MilestoneEvidenceMax = 20
  const validKinds = ['company', 'gtm', 'initiative']
  const validStatuses = ['active', 'draft', 'done', 'dropped']
  const validOwners = ['ceo', 'cmo', 'cto']
  const validMilestoneStatuses = ['open', 'in-progress', 'done']

  // Lenient entry parsers — the upsertStrategy backlog convention: keep only
  // objects carrying the required subfields, normalize the rest, drop the malformed.
  const parseKeyResults = (list) =>
    list
      .filter(
        (kr) =>
          kr &&
          typeof kr === 'object' &&
          typeof kr.metric === 'string' &&
          kr.metric.trim() &&
          (typeof kr.target === 'string' ||
            (typeof kr.target === 'number' && Number.isFinite(kr.target)))
      )
      .map((kr) => ({
        metric: kr.metric.trim(),
        target: kr.target,
        current:
          typeof kr.current === 'number' || typeof kr.current === 'string'
            ? kr.current
            : null,
        unit: typeof kr.unit === 'string' ? kr.unit : '',
      }))
  const parseMilestones = (list) =>
    list
      .filter(
        (ms) =>
          ms &&
          typeof ms === 'object' &&
          typeof ms.title === 'string' &&
          ms.title.trim() &&
          validMilestoneStatuses.indexOf(ms.status) !== -1
      )
      .map((ms) => ({
        title: ms.title.trim(),
        status: ms.status,
        estimate: typeof ms.estimate === 'string' ? ms.estimate : '',
        targetDate: typeof ms.targetDate === 'string' ? ms.targetDate : '',
        completedAt: typeof ms.completedAt === 'string' ? ms.completedAt : null,
        evidence: (Array.isArray(ms.evidence) ? ms.evidence : [])
          .filter((ref) => typeof ref === 'string')
          .slice(-MilestoneEvidenceMax),
      }))

  // Keep only the recognized, correctly-typed fields — the upsertStrategy
  // patch semantics: unrecognized fields never land; bad enums reject loudly.
  const patch = {}
  let hasField = false
  if (args.kind !== undefined) {
    if (validKinds.indexOf(args.kind) === -1)
      return { ok: false, reason: 'invalid kind: ' + args.kind }
    patch.kind = args.kind
    hasField = true
  }
  if (args.status !== undefined) {
    if (validStatuses.indexOf(args.status) === -1)
      return { ok: false, reason: 'invalid status: ' + args.status }
    patch.status = args.status
    hasField = true
  }
  if (args.owner !== undefined) {
    if (validOwners.indexOf(args.owner) === -1)
      return { ok: false, reason: 'invalid owner: ' + args.owner }
    patch.owner = args.owner
    hasField = true
  }
  if (typeof args.title === 'string' && args.title.trim()) {
    patch.title = args.title.trim()
    hasField = true
  }
  if (typeof args.objective === 'string' && args.objective.trim()) {
    patch.objective = args.objective.trim().slice(0, TextMaxChars)
    hasField = true
  }
  if (typeof args.notes === 'string') {
    patch.notes = args.notes.slice(0, TextMaxChars)
    hasField = true
  }
  if (typeof args.linkedInitiative === 'string') {
    patch.linkedInitiative = args.linkedInitiative.trim()
    hasField = true
  }
  if (Array.isArray(args.keyResults)) {
    patch.keyResults = parseKeyResults(args.keyResults)
    hasField = true
  }
  if (Array.isArray(args.milestones)) {
    patch.milestones = parseMilestones(args.milestones)
    hasField = true
  }
  if (!hasField) return { ok: false, reason: 'no recognized plan fields' }

  // Resolve the record to write: an explicit id patches that plan; otherwise
  // the (kind, trimmed lowercase title) pair dedupes — a match updates in
  // place, else a new plan is created.
  let existing = null
  const explicitId = typeof args.id === 'string' ? args.id.trim() : ''
  if (explicitId) {
    existing = await records.get('plans', explicitId)
    if (!existing) return { ok: false, reason: 'plan not found: ' + explicitId }
  } else {
    if (!patch.kind || !patch.title)
      return { ok: false, reason: 'kind and title are required without an explicit id' }
    const sameKind = await records.query('plans', {
      where: [{ field: 'kind', op: 'eq', value: patch.kind }],
    })
    const key = patch.title.toLowerCase()
    const match = sameKind.find(
      (rec) =>
        typeof rec.data.title === 'string' && rec.data.title.trim().toLowerCase() === key
    )
    if (match) existing = match
  }

  // Effective post-patch record; creation requires every schema-required field.
  const base = existing
    ? existing.data
    : {
        kind: '',
        title: '',
        objective: '',
        owner: '',
        status: '',
        keyResults: [],
        milestones: [],
        linkedInitiative: '',
        notes: '',
      }
  const data = Object.assign({}, base, patch)
  if (
    !existing &&
    (!data.kind || !data.title || !data.objective || !data.owner || !data.status)
  )
    return {
      ok: false,
      reason: 'kind, title, objective, owner, and status are required to create a plan',
    }

  // Role-vs-owner lane check against the CALLER's board_members role (never
  // args): CEO writes any plan; CMO only cmo-owned gtm plans; CTO only
  // cto-owned initiative plans. Runs on the EFFECTIVE owner+kind so a patch
  // can never move a plan out of the caller's lane.
  if (role !== 'ceo') {
    if (role === 'cmo' && (data.owner !== 'cmo' || data.kind !== 'gtm'))
      return { ok: false, reason: 'role cmo may only write cmo-owned gtm plans' }
    if (role === 'cto' && (data.owner !== 'cto' || data.kind !== 'initiative'))
      return { ok: false, reason: 'role cto may only write cto-owned initiative plans' }
    if (role !== 'cmo' && role !== 'cto')
      return { ok: false, reason: 'role ' + role + ' may not write plans' }
  }
  // The write records its author — the board Functions' updatedByAgentId convention.
  data.updatedByAgentId = caller.agentId

  const saved = await records.upsert(
    'plans',
    existing ? { id: existing.id, data: data } : { data: data }
  )
  return { ok: true, saved: true, planId: saved.id, updated: !!existing }
}
`

/** Seed record for the `upsertPlan` Function (stable id — idempotent reconcile). */
export const UpsertPlanFunctionDef = {
  id: `fn_bplan01`,
  name: `upsertPlan`,
  description: `Create or patch a board plan (goals, keyResults, milestones, progress) in the plans Collection. Explicit id patches in place; otherwise kind+title dedupes. Recognized fields only, last-write-wins; objective/notes cap at ~4000 chars; malformed keyResults/milestones entries are dropped. Caller must hold a board_members record and the role gates the lane: CEO writes any plan, CMO only cmo-owned gtm plans, CTO only cto-owned initiative plans.`,
  language: EFunLanguage.javascript,
  content: UpsertPlanFunctionSource,
}

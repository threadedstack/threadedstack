import { EFunLanguage } from '@tdsk/domain'

/**
 * `saveMarketingArtifact` — board effect Function (CMO seat, go-to-market reframe).
 *
 * The CMO's drafting surface: persists a GTM/marketing artifact (business-plan
 * section, gtm-plan, channel plan, campaign draft, ad-buy PROPOSAL with budget)
 * into the `marketing_artifacts` Collection via the ① `records` capability.
 * DRAFT-ONLY by construction: no external-send capability exists in the isolate,
 * so every record is a draft/proposal for the board — a budget is data, never a
 * spend.
 *
 * Caller gate is the ⑤a board-member pattern (openDecision/postPosition): the
 * trusted platform-injected `context.caller` must hold a `board_members` record
 * (spec §5.1) — never resolved from model-emitted args.
 *
 * Upsert semantics: an explicit `id` arg revises that record in place; otherwise
 * the (trimmed lowercase title, kind) pair is the dedupe key — a matching
 * existing artifact is updated in place (the openDecision title-dedupe
 * convention), else a new record is created. Bodies cap at ~8000 chars
 * (truncated, never rejected — a one-shot cycle's draft is kept, not lost).
 */
export const SaveMarketingArtifactFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  // Board-member gate — the ⑤a caller-gate pattern, resolved from
  // board_members records via the trusted platform-injected caller.
  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }
  const members = await records.query('board_members', {
    where: [{ field: 'agentId', op: 'eq', value: caller.agentId }],
  })
  if (!members.length) return { ok: false, reason: 'caller is not a board member' }

  // Input validation: non-empty kind/title/body, status in the artifact set.
  const BodyMaxChars = 8000
  const kind = typeof args.kind === 'string' ? args.kind.trim() : ''
  const title = typeof args.title === 'string' ? args.title.trim() : ''
  const body = typeof args.body === 'string' ? args.body : ''
  const status = typeof args.status === 'string' ? args.status : ''
  const validStatuses = ['draft', 'proposed', 'approved']
  if (!kind || !title || !body.trim())
    return { ok: false, reason: 'kind, title, and body are required' }
  if (validStatuses.indexOf(status) === -1)
    return { ok: false, reason: 'invalid status: ' + status }
  const budget =
    args.budget && typeof args.budget === 'object' && !Array.isArray(args.budget)
      ? args.budget
      : null
  const evidence = Array.isArray(args.evidence)
    ? args.evidence.filter((ref) => typeof ref === 'string')
    : []

  // Resolve the record to write: an explicit id revises in place; otherwise the
  // (trimmed lowercase title, kind) pair dedupes against existing artifacts so a
  // re-draft updates rather than duplicating.
  let existingId = typeof args.id === 'string' ? args.id.trim() : ''
  if (!existingId) {
    const sameKind = await records.query('marketing_artifacts', {
      where: [{ field: 'kind', op: 'eq', value: kind }],
    })
    const key = title.toLowerCase()
    const match = sameKind.find(
      (rec) =>
        typeof rec.data.title === 'string' && rec.data.title.trim().toLowerCase() === key
    )
    if (match) existingId = match.id
  }

  const data = {
    kind: kind,
    title: title,
    body: body.length > BodyMaxChars ? body.slice(0, BodyMaxChars) : body,
    status: status,
    budget: budget,
    evidence: evidence,
    updatedByAgentId: caller.agentId,
  }
  const saved = await records.upsert(
    'marketing_artifacts',
    existingId ? { id: existingId, data: data } : { data: data }
  )
  return { ok: true, saved: true, artifactId: saved.id, updated: !!existingId }
}
`

/** Seed record for the `saveMarketingArtifact` Function (stable id — idempotent reconcile). */
export const SaveMarketingArtifactFunctionDef = {
  id: `fn_bmkart1`,
  name: `saveMarketingArtifact`,
  description: `Persist a CMO go-to-market/marketing artifact (gtm-plan, channel-plan, campaign, ad-proposal, business-plan) as a DRAFT/PROPOSAL record in marketing_artifacts. Caller must hold a board_members record; upserts by explicit id or the title+kind dedupe key; bodies cap at ~8000 chars. No external-send capability exists — a budget is a proposal, never a spend.`,
  language: EFunLanguage.javascript,
  content: SaveMarketingArtifactFunctionSource,
}

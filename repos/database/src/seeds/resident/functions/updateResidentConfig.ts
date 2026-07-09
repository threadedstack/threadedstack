import { EFunLanguage } from '@tdsk/domain'

/**
 * `updateResidentConfig` — resident effect Function (Resident Agents R3,
 * spec §2 + §5.1).
 *
 * Self-scoped config evolution: the caller may patch ONLY the
 * `resident_configs` record whose `agentId` equals the platform-injected
 * `context.caller.agentId` — "the internal monitor is theirs". Recognized
 * fields only: array sections (agenda/watches/actions) and object sections
 * (inbox/compaction/session/subAgents/selfDirected/functions); unknown keys
 * are never written, and `agentId` is re-pinned to the caller so the record
 * can never be re-homed. Patching `actions` is the spec §5.1 self-granted
 * allowlist entry — every capability grant is an auditable record write.
 */
export const UpdateResidentConfigFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }

  // Self-scope: ONLY the caller's own config record is patchable.
  const existing = await records.query('resident_configs', {
    where: [{ field: 'agentId', op: 'eq', value: caller.agentId }],
    limit: 1,
  })
  if (!existing.length)
    return { ok: false, reason: 'no resident_configs record for caller' }

  // Recognized fields only — unknown keys are ignored, never written.
  const arrayFields = ['agenda', 'watches', 'actions']
  const objectFields = [
    'inbox',
    'compaction',
    'session',
    'subAgents',
    'selfDirected',
    'functions',
  ]
  const patch = {}
  const applied = []
  for (const field of arrayFields) {
    if (Array.isArray(args[field])) {
      patch[field] = args[field]
      applied.push(field)
    }
  }
  for (const field of objectFields) {
    if (args[field] && typeof args[field] === 'object' && !Array.isArray(args[field])) {
      patch[field] = args[field]
      applied.push(field)
    }
  }
  if (!applied.length)
    return { ok: false, reason: 'no recognized config fields in patch' }

  // agentId is re-pinned to the caller — the record can never be re-homed.
  // evolvedByAgent flags that the agent has taken ownership: from here the
  // deploy reconcile leaves the config untouched (before this flag is set, the
  // platform re-applies the seed so capability/prompt updates propagate).
  const data = Object.assign({}, existing[0].data, patch, {
    agentId: caller.agentId,
    evolvedByAgent: true,
  })
  await records.upsert('resident_configs', { id: existing[0].id, data: data })
  return { ok: true, updated: applied }
}
`

/** Seed record for the `updateResidentConfig` Function (stable id — idempotent reconcile). */
export const UpdateResidentConfigFunctionDef = {
  id: `fn_rupdcfg`,
  name: `updateResidentConfig`,
  description: `Patch the caller's OWN resident_configs record (self-scoped by the platform-injected caller identity — no other agent's config is reachable). Recognized fields only: agenda/watches/actions arrays + inbox/compaction/session/subAgents/selfDirected/functions objects; agentId is re-pinned to the caller.`,
  language: EFunLanguage.javascript,
  content: UpdateResidentConfigFunctionSource,
}

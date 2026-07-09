import { EFunLanguage } from '@tdsk/domain'

/**
 * `heartbeat` — resident effect Function (Resident Agents R3, spec §2).
 *
 * Upserts the caller's `resident_status` record (keyed by the
 * platform-injected `context.caller.agentId` — one liveness record per
 * resident, never another agent's). The record's write time IS the liveness
 * signal the watchdog reads (<3 min = fresh). The `degraded` flag is owned
 * SOLELY by the watchdog (set on crash-loop / misconfig, cleared on a healthy
 * tick), so the beat MERGES over the existing record and never writes
 * `degraded` — otherwise a live beat would clobber the watchdog's assessment.
 */
export const HeartbeatFunctionSource = `export default async (request, context) => {
  const args = context.args || {}
  const caller = context.caller || {}
  const records = context.records

  if (!caller.agentId) return { ok: false, reason: 'no caller identity' }

  // Self-scope: the liveness record is keyed by the trusted caller identity.
  const existing = await records.query('resident_status', {
    where: [{ field: 'agentId', op: 'eq', value: caller.agentId }],
    limit: 1,
  })

  // Merge over any existing record so watchdog-owned fields survive the beat
  // (the watchdog is the sole writer of the crash-loop status flag).
  const prev = existing.length ? (existing[0].data || {}) : {}
  const data = {
    ...prev,
    agentId: caller.agentId,
    sessionId: typeof args.sessionId === 'string' ? args.sessionId : null,
    queueDepth: typeof args.queueDepth === 'number' ? args.queueDepth : 0,
    currentActivity:
      typeof args.currentActivity === 'string'
        ? args.currentActivity.slice(0, 500)
        : 'unknown',
    lastTurnAt: typeof args.lastTurnAt === 'string' ? args.lastTurnAt : null,
    turnCount: typeof args.turnCount === 'number' ? args.turnCount : 0,
  }
  const saved = await records.upsert(
    'resident_status',
    existing.length ? { id: existing[0].id, data: data } : { data: data }
  )
  return { ok: true, statusId: saved.id }
}
`

/** Seed record for the `heartbeat` Function (stable id — idempotent reconcile). */
export const HeartbeatFunctionDef = {
  id: `fn_rhearbt`,
  name: `heartbeat`,
  description: `Upsert the caller's resident_status liveness record ({ sessionId, queueDepth, currentActivity, lastTurnAt, turnCount }), keyed by the platform-injected caller identity. The record's write time is the heartbeat freshness the watchdog reads. The 'degraded' flag is watchdog-owned; the beat merges over the existing record and never writes it.`,
  language: EFunLanguage.javascript,
  content: HeartbeatFunctionSource,
}

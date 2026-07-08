import { EFunLanguage } from '@tdsk/domain'

/**
 * `heartbeat` — resident effect Function (Resident Agents R3, spec §2).
 *
 * Upserts the caller's `resident_status` record (keyed by the
 * platform-injected `context.caller.agentId` — one liveness record per
 * resident, never another agent's). The record's write time IS the liveness
 * signal the watchdog reads (<3 min = fresh); a live beat also clears
 * `degraded`, since the watchdog's in-memory crash-loop window — not the
 * record flag — decides restart skipping.
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

  const data = {
    agentId: caller.agentId,
    sessionId: typeof args.sessionId === 'string' ? args.sessionId : null,
    queueDepth: typeof args.queueDepth === 'number' ? args.queueDepth : 0,
    currentActivity:
      typeof args.currentActivity === 'string'
        ? args.currentActivity.slice(0, 500)
        : 'unknown',
    lastTurnAt: typeof args.lastTurnAt === 'string' ? args.lastTurnAt : null,
    turnCount: typeof args.turnCount === 'number' ? args.turnCount : 0,
    // A live beat IS the liveness signal — the watchdog re-marks degraded
    // whenever its crash-loop window says otherwise.
    degraded: false,
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
  description: `Upsert the caller's resident_status liveness record ({ sessionId, queueDepth, currentActivity, lastTurnAt, turnCount }), keyed by the platform-injected caller identity. The record's write time is the heartbeat freshness the watchdog reads; a live beat clears degraded.`,
  language: EFunLanguage.javascript,
  content: HeartbeatFunctionSource,
}

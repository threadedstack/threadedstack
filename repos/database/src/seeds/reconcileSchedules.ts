import type { TAgentScheduleDef } from '@TDB/seeds/agentSchedules'

/**
 * Reconcile logic for the agent's git-versioned operating schedules. Pure and
 * DB-agnostic (it takes an injected service), so it is unit-testable without a
 * live connection. The runner in scripts/reconcileSchedules.ts wires it to the
 * real schedule service and runs it as a deploy step.
 *
 * Only DECLARATIVE fields are written. Runtime bookkeeping (lastRunAt,
 * nextRunAt, consecutiveErrors) is never included, so `update` preserves it.
 */

export type TReconcileResult = { data?: any; error?: any }

export type TReconcileService = {
  get: (id: string) => Promise<TReconcileResult>
  create: (item: any) => Promise<TReconcileResult>
  update: (item: any) => Promise<TReconcileResult>
}

export type TReconcileAction = `created` | `updated` | `unchanged` | `error`

/**
 * Order-independent JSON string for a value. jsonb columns do NOT preserve key
 * order across a write/read round trip, so a plain JSON.stringify diff would
 * churn a schedule whose contextSources round-trips. Sorting keys makes the
 * comparison stable. `null`/`undefined` both collapse to `"null"`, so a schedule
 * without contextSources never counts as changed.
 */
const stableStringify = (value: unknown): string => {
  if (value === null || value === undefined) return `null`
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(`,`)}]`
  if (typeof value === `object`) {
    const keys = Object.keys(value as Record<string, unknown>).sort()
    return `{${keys
      .map(
        (key) =>
          `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`
      )
      .join(`,`)}}`
  }
  return JSON.stringify(value)
}

export type TReconcileSummary = {
  created: number
  updated: number
  unchanged: number
  errors: number
  results: { id: string; key: string; action: TReconcileAction; message?: string }[]
}

/** The declarative fields the reconciler manages — runtime state is excluded. */
export const declarativeFields = (def: TAgentScheduleDef) => ({
  id: def.id,
  prompt: def.prompt,
  cronExpression: def.cronExpression,
  enabled: def.enabled,
  type: def.type,
  timeoutMs: def.timeoutMs,
  maxConsecutiveErrors: def.maxConsecutiveErrors,
  agentId: def.agentId,
  sandboxId: def.sandboxId,
  orgId: def.orgId,
  projectId: def.projectId,
  contextSources: def.contextSources ?? null,
})

/** True when any declarative field on the live row differs from the definition. */
export const needsUpdate = (existing: any, def: TAgentScheduleDef): boolean =>
  existing.prompt !== def.prompt ||
  existing.cronExpression !== def.cronExpression ||
  existing.enabled !== def.enabled ||
  existing.type !== def.type ||
  (existing.timeoutMs ?? null) !== (def.timeoutMs ?? null) ||
  existing.maxConsecutiveErrors !== def.maxConsecutiveErrors ||
  (existing.agentId ?? null) !== (def.agentId ?? null) ||
  existing.sandboxId !== def.sandboxId ||
  existing.orgId !== def.orgId ||
  existing.projectId !== def.projectId ||
  stableStringify(existing.contextSources) !== stableStringify(def.contextSources)

/**
 * Upsert each definition's declarative fields into the schedules table:
 *   - missing row  -> create (repo is the source of truth), seeding nextRunAt to
 *                     now so the scheduler picks it up and then recomputes the
 *                     real next fire from the cron on markRun.
 *   - existing row -> update ONLY when a declarative field differs (no churn).
 * Never throws; every row's outcome is captured in the summary.
 */
export const reconcileSchedules = async (
  service: TReconcileService,
  defs: TAgentScheduleDef[],
  log: (msg: string) => void = () => {}
): Promise<TReconcileSummary> => {
  const summary: TReconcileSummary = {
    created: 0,
    updated: 0,
    unchanged: 0,
    errors: 0,
    results: [],
  }

  const fail = (def: TAgentScheduleDef, message?: string) => {
    summary.errors++
    summary.results.push({ id: def.id, key: def.key, action: `error`, message })
    log(`  ❌ ${def.key} (${def.id}) — ${message ?? `unknown error`}`)
  }

  for (const def of defs) {
    try {
      const existing = await service.get(def.id)
      if (existing.error) {
        fail(def, `get failed: ${existing.error.message}`)
        continue
      }

      if (!existing.data) {
        const res = await service.create({
          ...declarativeFields(def),
          nextRunAt: new Date(),
        })
        if (res.error) fail(def, `create failed: ${res.error.message}`)
        else {
          summary.created++
          summary.results.push({ id: def.id, key: def.key, action: `created` })
          log(`  ✅ ${def.key} (${def.id}) — created`)
        }
        continue
      }

      if (!needsUpdate(existing.data, def)) {
        summary.unchanged++
        summary.results.push({ id: def.id, key: def.key, action: `unchanged` })
        log(`  ➖ ${def.key} (${def.id}) — unchanged`)
        continue
      }

      const res = await service.update(declarativeFields(def))
      if (res.error) fail(def, `update failed: ${res.error.message}`)
      else {
        summary.updated++
        summary.results.push({ id: def.id, key: def.key, action: `updated` })
        log(`  🔄 ${def.key} (${def.id}) — updated`)
      }
    } catch (err: any) {
      fail(def, err?.message)
    }
  }

  return summary
}

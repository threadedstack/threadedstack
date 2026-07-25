import type { TAgentScheduleDef } from '@TDB/seeds/agentSchedules'

/**
 * Reconcile logic for the agent's git-versioned operating schedules. Pure and
 * DB-agnostic (it takes an injected service), so it is unit-testable without a
 * live connection. The runner in scripts/reconcileSchedules.ts wires it to the
 * real schedule service and runs it as a deploy step.
 *
 * Only DECLARATIVE fields are written. Runtime bookkeeping (lastRunAt,
 * nextRunAt, consecutiveErrors) is never included, so `update` preserves it.
 *
 * The scheduled sandboxes' NODE-POOL PLACEMENT is reconciled here too
 * (`reconcileScheduledSandboxNodePools` at the bottom of this file, driven by
 * `ScheduledSandboxNodePools` in seeds/agentSchedules.ts): where a schedule's
 * job pod RUNS is as much a part of the schedule's git-declared definition as
 * its cron, and the same deploy step (scripts/reconcileSchedules.ts) asserts
 * both. Like `defs`, the placement map is INJECTED rather than imported — this
 * module must stay free of a value import from seeds/agentSchedules (which
 * reads the prompt `.md` files from disk at module-evaluation time), because
 * the backend bundles `stableStringify` below via
 * seeds/dev-loop/syncTaskProposals.
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
 * without contextSources never counts as changed. Exported for the dev-loop
 * table->collection sync (seeds/dev-loop/syncTaskProposals.ts), which needs the
 * same jsonb-safe drift comparison for record documents.
 */
export const stableStringify = (value: unknown): string => {
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
  userId: def.userId,
  contextSources: def.contextSources ?? null,
  actions: def.actions ?? null,
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
  (existing.userId ?? null) !== (def.userId ?? null) ||
  stableStringify(existing.contextSources) !== stableStringify(def.contextSources) ||
  stableStringify(existing.actions) !== stableStringify(def.actions)

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

/** The sandbox service slice the placement reconcile needs: read a config, write
 * the merged config back. Narrow on purpose so the logic stays unit-testable
 * against an in-memory fake, exactly like `TReconcileService` above. */
export type TScheduledSandboxPoolService = {
  get: (
    id: string
  ) => Promise<{ data?: { config?: Record<string, any> | null } | null; error?: any }>
  update: (data: {
    id: string
    config: Record<string, any>
  }) => Promise<{ data?: any; error?: any }>
}

export type TScheduledSandboxPoolAction = `asserted` | `unchanged` | `error`

export type TScheduledSandboxPoolSummary = {
  asserted: number
  unchanged: number
  errors: number
  results: {
    sandboxId: string
    nodePool: string
    action: TScheduledSandboxPoolAction
    message?: string
  }[]
}

/**
 * Re-assert every git-declared scheduled-sandbox node pool onto the live sandbox
 * configs, so a config wipe or hand-edit drift can misplace a scheduled job for
 * at most one deploy cycle.
 *
 * `pools` (sandbox id -> Civo node pool) is INJECTED for the same reason `defs`
 * is: the real map is `ScheduledSandboxNodePools` in seeds/agentSchedules.ts,
 * and importing it here as a value would drag that module's module-evaluation
 * prompt-file reads into the backend bundle (it reaches this file through
 * seeds/dev-loop/syncTaskProposals' `stableStringify` import). The deploy runner
 * (scripts/reconcileSchedules.ts) wires the two together.
 *
 * Per declared sandbox:
 * 1. Read the config. A config already carrying the declared pool is a TRUE
 *    no-op — `update` is never called, so a converged deploy writes nothing and
 *    a live sandbox is never churned by this step.
 * 2. Otherwise READ-MERGE-WRITE: spread the existing config FIRST and set only
 *    `nodePool`. The `config` jsonb is a FULL-COLUMN REPLACE at the service layer
 *    (services/base.ts `.set({ ...rest })`), so an omitted key is a DELETED key —
 *    every other key (image, initScript, resources, idleTimeoutMinutes,
 *    runtimeCommand, envVars, the resident flag) must ride along untouched.
 *
 * The pool is asserted unconditionally: agents never self-edit their sandbox
 * config, so any divergence is out-of-band drift — the exact failure class this
 * reconcile exists to erase.
 *
 * Never throws — every outcome lands in the summary, and the runner turns a
 * non-zero error count into a deploy warning rather than a rollback.
 */
export const reconcileScheduledSandboxNodePools = async (
  service: TScheduledSandboxPoolService,
  pools: Record<string, string>,
  log: (msg: string) => void = () => {}
): Promise<TScheduledSandboxPoolSummary> => {
  const summary: TScheduledSandboxPoolSummary = {
    asserted: 0,
    unchanged: 0,
    errors: 0,
    results: [],
  }

  const fail = (sandboxId: string, nodePool: string, message?: string) => {
    summary.errors++
    summary.results.push({ sandboxId, nodePool, action: `error`, message })
    log(`  ❌ node pool ${sandboxId} — ${message ?? `unknown error`}`)
  }

  for (const [sandboxId, nodePool] of Object.entries(pools)) {
    try {
      const existing = await service.get(sandboxId)
      if (existing.error) {
        fail(sandboxId, nodePool, `get failed: ${existing.error.message}`)
        continue
      }
      if (!existing.data) {
        fail(sandboxId, nodePool, `sandbox ${sandboxId} not found`)
        continue
      }

      const config = (existing.data.config ?? {}) as Record<string, any>
      if (config.nodePool === nodePool) {
        summary.unchanged++
        summary.results.push({ sandboxId, nodePool, action: `unchanged` })
        log(`  ➖ node pool ${sandboxId} — already on ${nodePool}`)
        continue
      }

      // `...config` FIRST: the jsonb column is replaced wholesale, so every key
      // the reconcile does not own must be carried through the write.
      const res = await service.update({
        id: sandboxId,
        config: { ...config, nodePool },
      })
      if (res.error) {
        fail(sandboxId, nodePool, `update failed: ${res.error.message}`)
        continue
      }

      summary.asserted++
      summary.results.push({ sandboxId, nodePool, action: `asserted` })
      log(`  ✅ node pool ${sandboxId} — pinned to ${nodePool}`)
    } catch (err: any) {
      fail(sandboxId, nodePool, err?.message)
    }
  }

  return summary
}

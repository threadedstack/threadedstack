import { database } from '@TDB/database'
import { loadEnvs } from '@tdsk/domain'
import { ife } from '@keg-hub/jsutils/ife'
import { AgentScheduleDefs, ScheduledSandboxNodePools } from '@TDB/seeds/agentSchedules'
import {
  reconcileSchedules,
  reconcileScheduledSandboxNodePools,
} from '@TDB/seeds/reconcileSchedules'

/**
 * Deploy-time reconcile of the autonomous agent's own operating schedules.
 * Upserts the declarative fields (prompt + cadence + bindings) of every row in
 * AgentScheduleDefs from git-versioned config into the live `schedules` table,
 * so the agent's operating prompts evolve through the normal PR -> deploy
 * pipeline instead of ad-hoc production edits. Then it re-asserts the
 * git-declared NODE-POOL PLACEMENT of the scheduled sandboxes
 * (ScheduledSandboxNodePools — the steward's body sandbox on the reserved
 * `tdskembed` node), so where a job pod RUNS is git-owned like its cadence and
 * an erased pin cannot silently strand the steward's jobs Pending on the packed
 * default pool. Idempotent: unchanged rows are skipped, runtime bookkeeping is
 * never touched, and a sandbox already on its declared pool is not written.
 *
 * Invoked by `pnpm reconcile:schedules` (see cli release step).
 */

const nodeEnv = process.env.NODE_ENV
loadEnvs({ force: nodeEnv === `local` })
const db = database()

ife(async () => {
  console.log(`🗓️  Reconciling agent schedules from repo config...`)

  const summary = await reconcileSchedules(
    db.services.schedule,
    AgentScheduleDefs,
    (msg) => console.log(msg)
  )

  // The placement reconcile passes the full read-merged config; bridge its loose
  // Record type to the sandbox service's strict update-input type (the same
  // bridge scripts/reconcileResident.ts builds for the resident body reconcile).
  const sandboxSlice = {
    get: (id: string) => db.services.sandbox.get(id),
    update: (data: { id: string; config: Record<string, any> }) =>
      db.services.sandbox.update(
        data as Parameters<typeof db.services.sandbox.update>[0]
      ),
  }

  console.log(`🧭 Reconciling scheduled sandbox node pools from repo config...`)
  const poolSummary = await reconcileScheduledSandboxNodePools(
    sandboxSlice,
    ScheduledSandboxNodePools,
    (msg) => console.log(msg)
  )

  const errors = summary.errors + poolSummary.errors

  console.log(`═══════════════════════════════════════`)
  console.log(`📊 Schedule reconcile summary:`)
  console.log(`   ✅ Created:   ${summary.created}`)
  console.log(`   🔄 Updated:   ${summary.updated}`)
  console.log(`   ➖ Unchanged: ${summary.unchanged}`)
  console.log(`   🧭 Node pools asserted:  ${poolSummary.asserted}`)
  console.log(`   ➖ Node pools unchanged: ${poolSummary.unchanged}`)
  console.log(`   ❌ Errors:    ${errors}`)
  console.log(`═══════════════════════════════════════`)

  process.exit(errors > 0 ? 1 : 0)
}).catch((err: any) => {
  console.error(`Schedule reconcile failed:`, err?.message)
  process.exit(1)
})

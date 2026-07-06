import { database } from '@TDB/database'
import { loadEnvs } from '@tdsk/domain'
import { ife } from '@keg-hub/jsutils/ife'
import { AgentScheduleDefs } from '@TDB/seeds/agentSchedules'
import { reconcileSchedules } from '@TDB/seeds/reconcileSchedules'

/**
 * Deploy-time reconcile of the autonomous agent's own operating schedules.
 * Upserts the declarative fields (prompt + cadence + bindings) of every row in
 * AgentScheduleDefs from git-versioned config into the live `schedules` table,
 * so the agent's operating prompts evolve through the normal PR -> deploy
 * pipeline instead of ad-hoc production edits. Idempotent: unchanged rows are
 * skipped; runtime bookkeeping is never touched.
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

  console.log(`═══════════════════════════════════════`)
  console.log(`📊 Schedule reconcile summary:`)
  console.log(`   ✅ Created:   ${summary.created}`)
  console.log(`   🔄 Updated:   ${summary.updated}`)
  console.log(`   ➖ Unchanged: ${summary.unchanged}`)
  console.log(`   ❌ Errors:    ${summary.errors}`)
  console.log(`═══════════════════════════════════════`)

  process.exit(summary.errors > 0 ? 1 : 0)
}).catch((err: any) => {
  console.error(`Schedule reconcile failed:`, err?.message)
  process.exit(1)
})

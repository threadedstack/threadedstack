import { database } from '@TDB/database'
import { loadEnvs } from '@tdsk/domain'
import { ife } from '@keg-hub/jsutils/ife'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { reconcileDevTeam } from '@TDB/seeds/dev-team/collections'

/**
 * Deploy-time reconcile of the realtime dev-team's shared work Collections
 * (`dev_tasks` — the concurrent task/review state machine coordinated via the
 * atomic records.cas primitive). Idempotent: existing collections are skipped,
 * so a re-run makes no changes. Additive and inert — nothing consumes the
 * collection until the Phase 2 shadow team is stood up.
 */

const nodeEnv = process.env.NODE_ENV
loadEnvs({ force: nodeEnv === `local` })
const db = database()

ife(async () => {
  console.log(`🗂️  Reconciling dev-team collections from repo config...`)

  const summary = await reconcileDevTeam(
    { collection: db.services.collection },
    OpsProjectId,
    (msg) => console.log(msg)
  )

  console.log(`═══════════════════════════════════════`)
  console.log(`📊 Dev-team reconcile summary:`)
  console.log(`   ✅ Collections created:   ${summary.collectionsCreated}`)
  console.log(`   ➖ Collections unchanged: ${summary.collectionsUnchanged}`)
  console.log(`   ❌ Errors:                ${summary.errors}`)
  console.log(`═══════════════════════════════════════`)

  process.exit(summary.errors > 0 ? 1 : 0)
}).catch((err: any) => {
  console.error(`Dev-team reconcile failed:`, err?.message)
  process.exit(1)
})

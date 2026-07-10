import { database } from '@TDB/database'
import { loadEnvs } from '@tdsk/domain'
import { ife } from '@keg-hub/jsutils/ife'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { reconcileDevTeam } from '@TDB/seeds/dev-team/collections'
import { reconcileDevTeamFunctions } from '@TDB/seeds/dev-team/functions'

/**
 * Deploy-time reconcile of the realtime dev-team's shared work Collections
 * (`dev_tasks` — the concurrent task/review state machine coordinated via the
 * atomic records.cas primitive) and its nine effect Functions (devClaimTask /
 * devSubmitPr / devClaimReview / devCompleteReview / devMarkMerged /
 * devUpdatePr / devRenewLease / devAddTask / devReapExpired — the state
 * machine's ONLY write path). Idempotent: existing collections are skipped and
 * Functions update only on drift, so a re-run makes no changes. Additive and
 * inert — nothing invokes these until the Phase 2 shadow team's sandboxes are
 * flipped to resident mode.
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

  console.log(`🧩 Reconciling dev-team effect Functions from repo config...`)
  const fnSummary = await reconcileDevTeamFunctions(
    db.services.function,
    OpsProjectId,
    (msg) => console.log(msg)
  )

  console.log(`═══════════════════════════════════════`)
  console.log(`📊 Dev-team reconcile summary:`)
  console.log(`   ✅ Collections created:   ${summary.collectionsCreated}`)
  console.log(`   ➖ Collections unchanged: ${summary.collectionsUnchanged}`)
  console.log(`   ✅ Functions created:     ${fnSummary.created}`)
  console.log(`   🔄 Functions updated:     ${fnSummary.updated}`)
  console.log(`   ➖ Functions unchanged:   ${fnSummary.unchanged}`)
  console.log(`   ❌ Errors:                ${summary.errors + fnSummary.errors}`)
  console.log(`═══════════════════════════════════════`)

  process.exit(summary.errors + fnSummary.errors > 0 ? 1 : 0)
}).catch((err: any) => {
  console.error(`Dev-team reconcile failed:`, err?.message)
  process.exit(1)
})

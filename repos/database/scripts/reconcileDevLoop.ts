import { database } from '@TDB/database'
import { loadEnvs } from '@tdsk/domain'
import { ife } from '@keg-hub/jsutils/ife'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { reconcileDevLoop } from '@TDB/seeds/dev-loop/collections'
import { reconcileDevLoopFunctions } from '@TDB/seeds/dev-loop/functions'

/**
 * Deploy-time reconcile of the dev-loop's workflow Collections and its five
 * effect Functions (Dev-Loop on Primitives ⑤b-2). Idempotently creates the
 * three workflow Collections (task_proposals / verifications / escalations —
 * NO seed records; live rows are copied at the Phase 4 cutovers) and
 * reconciles the git-versioned Function bodies into the live ops project, so
 * the whole workflow lives in git-versioned config and lands through the
 * normal PR -> deploy pipeline. Idempotent: existing collections are skipped
 * and Functions update only on drift, so a re-run makes no changes. Additive
 * and inert — no schedule invokes these until the per-workflow cutovers.
 */

const nodeEnv = process.env.NODE_ENV
loadEnvs({ force: nodeEnv === `local` })
const db = database()

ife(async () => {
  console.log(`🗂️  Reconciling dev-loop workflow collections from repo config...`)

  const summary = await reconcileDevLoop(
    { collection: db.services.collection },
    OpsProjectId,
    (msg) => console.log(msg)
  )

  console.log(`🧩 Reconciling dev-loop effect Functions from repo config...`)
  const fnSummary = await reconcileDevLoopFunctions(
    db.services.function,
    OpsProjectId,
    (msg) => console.log(msg)
  )

  console.log(`═══════════════════════════════════════`)
  console.log(`📊 Dev-loop reconcile summary:`)
  console.log(`   ✅ Collections created:   ${summary.collectionsCreated}`)
  console.log(`   ➖ Collections unchanged: ${summary.collectionsUnchanged}`)
  console.log(`   ✅ Functions created:     ${fnSummary.created}`)
  console.log(`   🔄 Functions updated:     ${fnSummary.updated}`)
  console.log(`   ➖ Functions unchanged:   ${fnSummary.unchanged}`)
  console.log(`   ❌ Errors:                ${summary.errors + fnSummary.errors}`)
  console.log(`═══════════════════════════════════════`)

  process.exit(summary.errors + fnSummary.errors > 0 ? 1 : 0)
}).catch((err: any) => {
  console.error(`Dev-loop reconcile failed:`, err?.message)
  process.exit(1)
})

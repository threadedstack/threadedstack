import { database } from '@TDB/database'
import { loadEnvs } from '@tdsk/domain'
import { ife } from '@keg-hub/jsutils/ife'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { reconcileExecBoard } from '@TDB/seeds/exec-board/collections'
import { reconcileExecBoardFunctions } from '@TDB/seeds/exec-board/functions'

/**
 * Deploy-time reconcile of the executive board's Collections + seed records
 * (⑤a-2) and its five effect Functions (⑤a-3). Idempotently creates the four
 * board Collections, upserts the membership + strategy-singleton records, and
 * reconciles the git-versioned board Function bodies into the live exec
 * project, so the whole board lives in git-versioned config and lands through
 * the normal PR -> deploy pipeline. Idempotent: existing collections are
 * skipped, records upsert by stable id, and Functions update only on drift, so
 * a re-run makes no changes. Additive and inert — no enabled schedule invokes
 * these yet.
 *
 * Applied to production only at activation (⑤a-5); until then this runs against
 * local/dev.
 */

const nodeEnv = process.env.NODE_ENV
loadEnvs({ force: nodeEnv === `local` })
const db = database()

ife(async () => {
  console.log(`🗂️  Reconciling exec-board collections + seed records from repo config...`)

  const summary = await reconcileExecBoard(
    { collection: db.services.collection, record: db.services.record },
    OpsProjectId,
    (msg) => console.log(msg)
  )

  console.log(`🧩 Reconciling exec-board effect Functions from repo config...`)
  const fnSummary = await reconcileExecBoardFunctions(
    db.services.function,
    OpsProjectId,
    (msg) => console.log(msg)
  )

  console.log(`═══════════════════════════════════════`)
  console.log(`📊 Exec-board reconcile summary:`)
  console.log(`   ✅ Collections created:   ${summary.collectionsCreated}`)
  console.log(`   ➖ Collections unchanged: ${summary.collectionsUnchanged}`)
  console.log(`   ✅ Records upserted:      ${summary.recordsUpserted}`)
  console.log(`   ✅ Functions created:     ${fnSummary.created}`)
  console.log(`   🔄 Functions updated:     ${fnSummary.updated}`)
  console.log(`   ➖ Functions unchanged:   ${fnSummary.unchanged}`)
  console.log(`   ❌ Errors:                ${summary.errors + fnSummary.errors}`)
  console.log(`═══════════════════════════════════════`)

  process.exit(summary.errors + fnSummary.errors > 0 ? 1 : 0)
}).catch((err: any) => {
  console.error(`Exec-board reconcile failed:`, err?.message)
  process.exit(1)
})

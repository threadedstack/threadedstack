import { database } from '@TDB/database'
import { loadEnvs } from '@tdsk/domain'
import { ife } from '@keg-hub/jsutils/ife'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { reconcileExecBoard } from '@TDB/seeds/exec-board/collections'

/**
 * Deploy-time reconcile of the executive board's Collections + seed records
 * (Exec-Board on Primitives ⑤a-2). Idempotently creates the four board
 * Collections and upserts the membership + strategy-singleton records into the
 * live exec project, so the board's state model lives in git-versioned config
 * and lands through the normal PR -> deploy pipeline. Idempotent: existing
 * collections are skipped and every record upserts by a stable id, so a re-run
 * makes no changes. Additive and inert — no effect Function or enabled schedule
 * reads these yet.
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

  console.log(`═══════════════════════════════════════`)
  console.log(`📊 Exec-board reconcile summary:`)
  console.log(`   ✅ Collections created:   ${summary.collectionsCreated}`)
  console.log(`   ➖ Collections unchanged: ${summary.collectionsUnchanged}`)
  console.log(`   ✅ Records upserted:      ${summary.recordsUpserted}`)
  console.log(`   ❌ Errors:                ${summary.errors}`)
  console.log(`═══════════════════════════════════════`)

  process.exit(summary.errors > 0 ? 1 : 0)
}).catch((err: any) => {
  console.error(`Exec-board reconcile failed:`, err?.message)
  process.exit(1)
})

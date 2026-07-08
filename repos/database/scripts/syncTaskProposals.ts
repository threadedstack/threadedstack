import { database } from '@TDB/database'
import { loadEnvs } from '@tdsk/domain'
import { ife } from '@keg-hub/jsutils/ife'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { taskProposals } from '@TDB/schemas/taskProposals'
import { syncTaskProposalRecords } from '@TDB/seeds/dev-loop/syncTaskProposals'

/**
 * Dev-loop `task_proposals` table -> Collection data sync (⑤b-4a). Copies every
 * row of the legacy table into the ops project's `task_proposals` Collection so
 * record-vs-row parity is observable while the work cycle dual-emits its
 * pickups (the table stays authoritative through the transition). PERSISTENT
 * and rerunnable — it runs at the 4a cutover, again at 4b, and any re-run over
 * unchanged rows writes nothing (record id = the table's tp_ id; the document
 * also carries it as `legacyId`).
 *
 * Invoked by `pnpm sync:task-proposals` (run at deploy time by the lead).
 */

const nodeEnv = process.env.NODE_ENV
loadEnvs({ force: nodeEnv === `local` })
const db = database()

ife(async () => {
  console.log(`🔁 Syncing task_proposals table rows into the ops Collection...`)

  const rows = await db.select().from(taskProposals)
  console.log(`   found ${rows.length} table row(s)`)

  const summary = await syncTaskProposalRecords(
    db.services.record,
    rows,
    OpsProjectId,
    (msg) => console.log(msg)
  )

  console.log(`═══════════════════════════════════════`)
  console.log(`📊 task_proposals sync summary:`)
  console.log(`   ✅ Created:   ${summary.created}`)
  console.log(`   🔄 Updated:   ${summary.updated}`)
  console.log(`   ➖ Unchanged: ${summary.unchanged}`)
  console.log(`   ❌ Errors:    ${summary.errors}`)
  console.log(`═══════════════════════════════════════`)

  process.exit(summary.errors > 0 ? 1 : 0)
}).catch((err: any) => {
  console.error(`task_proposals sync failed:`, err?.message)
  process.exit(1)
})

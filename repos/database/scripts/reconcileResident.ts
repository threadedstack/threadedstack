import { database } from '@TDB/database'
import { loadEnvs } from '@tdsk/domain'
import { ife } from '@keg-hub/jsutils/ife'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { reconcileResident } from '@TDB/seeds/resident/collections'
import { reconcileResidentFunctions } from '@TDB/seeds/resident/functions'

/**
 * Deploy-time reconcile of the resident data plane (Resident Agents R3):
 * idempotently creates the four resident Collections (resident_configs /
 * agent_messages / resident_status / resident_transcripts) and reconciles the
 * git-versioned bodies of the five resident effect Functions
 * (sendAgentMessage / updateResidentConfig / heartbeat / appendTranscript /
 * markMessageRead) into the ops project, so the whole resident surface lives
 * in git-versioned config and lands through the normal PR -> deploy pipeline.
 * Idempotent: existing collections are skipped and Functions update only on
 * drift, so a re-run makes no changes. Additive and inert — NO resident_configs
 * records are seeded (per-agent activation is R4), so the watchdog and the
 * dispatch allowlist resolver both find nothing until an agent is activated.
 */

const nodeEnv = process.env.NODE_ENV
loadEnvs({ force: nodeEnv === `local` })
const db = database()

ife(async () => {
  console.log(`🗂️  Reconciling resident collections from repo config...`)

  const summary = await reconcileResident(
    { collection: db.services.collection },
    OpsProjectId,
    (msg) => console.log(msg)
  )

  console.log(`🧩 Reconciling resident effect Functions from repo config...`)
  const fnSummary = await reconcileResidentFunctions(
    db.services.function,
    OpsProjectId,
    (msg) => console.log(msg)
  )

  console.log(`═══════════════════════════════════════`)
  console.log(`📊 Resident reconcile summary:`)
  console.log(`   ✅ Collections created:   ${summary.collectionsCreated}`)
  console.log(`   ➖ Collections unchanged: ${summary.collectionsUnchanged}`)
  console.log(`   ✅ Functions created:     ${fnSummary.created}`)
  console.log(`   🔄 Functions updated:     ${fnSummary.updated}`)
  console.log(`   ➖ Functions unchanged:   ${fnSummary.unchanged}`)
  console.log(`   ❌ Errors:                ${summary.errors + fnSummary.errors}`)
  console.log(`═══════════════════════════════════════`)

  process.exit(summary.errors + fnSummary.errors > 0 ? 1 : 0)
}).catch((err: any) => {
  console.error(`Resident reconcile failed:`, err?.message)
  process.exit(1)
})

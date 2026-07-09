import { database } from '@TDB/database'
import { loadEnvs } from '@tdsk/domain'
import { ife } from '@keg-hub/jsutils/ife'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { reconcileResident } from '@TDB/seeds/resident/collections'
import { reconcileResidentFunctions } from '@TDB/seeds/resident/functions'
import { reconcileResidentConfigs } from '@TDB/seeds/resident/records'
import { reconcileResidentActivations } from '@TDB/seeds/resident/activations'

/**
 * Deploy-time reconcile of the resident data plane (Resident Agents R3+R4):
 * idempotently creates the resident Collections (resident_configs /
 * agent_messages / resident_status / resident_transcripts / resident_memories),
 * reconciles the git-versioned bodies of the resident effect Functions
 * (sendAgentMessage / updateResidentConfig / heartbeat / appendTranscript /
 * markMessageRead / writeMemory), and reconciles the activated residents'
 * resident_configs records into the ops project. A config is created if absent
 * and re-applied from its seed on drift WHILE the platform owns it, so a
 * capability/prompt update reaches a live resident; once the agent evolves the
 * record via updateResidentConfig it is stamped `evolvedByAgent` and a deploy
 * never overwrites it again (the update is an atomic guarded replace, so a
 * self-evolution racing the reconcile is never clobbered). The whole resident
 * surface lives in git-versioned config and lands through the normal PR ->
 * deploy pipeline. Finally it reconciles the resident ACTIVATIONS: for each
 * agentId in the git-declared ResidentActivations list, it sets the agent's body
 * sandbox to resident mode (`config.resident = { agentId }`) so activation is
 * durable and re-asserted every deploy, not a one-off manual flip. A seeded
 * config whose agent is NOT in that list stays inert (the watchdog skips a
 * non-resident sandbox) — the inert-first pattern. Idempotent: collections are
 * create-if-absent, Functions/configs update only on drift, and activations set
 * only when the flag is missing, so a re-run makes no changes.
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

  console.log(`🤖 Reconciling resident config records from repo config...`)
  const cfgSummary = await reconcileResidentConfigs(
    db.services.record,
    OpsProjectId,
    (msg) => console.log(msg)
  )

  console.log(`🔌 Reconciling resident sandbox activations from repo config...`)
  const actSummary = await reconcileResidentActivations(
    {
      agent: db.services.agent,
      sandbox: {
        get: (id) => db.services.sandbox.get(id),
        // The reconcile passes the full read-merged config; bridge its loose
        // Record type to the sandbox service's strict update-input type.
        update: (data) =>
          db.services.sandbox.update(
            data as Parameters<typeof db.services.sandbox.update>[0]
          ),
      },
    },
    (msg) => console.log(msg)
  )

  const errors = summary.errors + fnSummary.errors + cfgSummary.errors + actSummary.errors

  console.log(`═══════════════════════════════════════`)
  console.log(`📊 Resident reconcile summary:`)
  console.log(`   ✅ Collections created:   ${summary.collectionsCreated}`)
  console.log(`   ➖ Collections unchanged: ${summary.collectionsUnchanged}`)
  console.log(`   ✅ Functions created:     ${fnSummary.created}`)
  console.log(`   🔄 Functions updated:     ${fnSummary.updated}`)
  console.log(`   ➖ Functions unchanged:   ${fnSummary.unchanged}`)
  console.log(`   ✅ Configs created:       ${cfgSummary.created}`)
  console.log(`   🔄 Configs updated:       ${cfgSummary.updated}`)
  console.log(`   ➖ Configs unchanged:     ${cfgSummary.unchanged}`)
  console.log(`   🔌 Activations set:       ${actSummary.activated}`)
  console.log(`   ➖ Activations unchanged: ${actSummary.unchanged}`)
  console.log(`   ❌ Errors:                ${errors}`)
  console.log(`═══════════════════════════════════════`)

  process.exit(errors > 0 ? 1 : 0)
}).catch((err: any) => {
  console.error(`Resident reconcile failed:`, err?.message)
  process.exit(1)
})

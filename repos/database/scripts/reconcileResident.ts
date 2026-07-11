import { eq } from 'drizzle-orm'
import { database } from '@TDB/database'
import { loadEnvs } from '@tdsk/domain'
import { ife } from '@keg-hub/jsutils/ife'
import { providers } from '@TDB/schemas/providers'
import { OpsProjectId } from '@TDB/seeds/agentSchedules'
import { sandboxProviders } from '@TDB/schemas/sandboxProviders'
import { reconcileResident } from '@TDB/seeds/resident/collections'
import { reconcileResidentFunctions } from '@TDB/seeds/resident/functions'
import { reconcileResidentConfigs } from '@TDB/seeds/resident/records'
import { reconcileResidentActivations } from '@TDB/seeds/resident/activations'
import {
  reconcileResidentBodies,
  reconcileResidentProviderChains,
} from '@TDB/seeds/resident/bodies'

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
 * deploy pipeline. Then it reconciles each activated resident's BODY: the boot
 * recipe (image/imagePullPolicy/initScript/setupScript/promptCommand + the
 * recipe envVars keys) is re-asserted onto the body sandbox config and the
 * agent's ops-project binding is created if absent, so a config wipe or
 * hand-edit drift can strand a seat for at most one deploy cycle. Next it
 * reconciles each seat's PROVIDER CHAIN: the sandbox provider links (the ONLY
 * path resident LLM auth flows through) are asserted to the three real
 * providers by NAME (ids are prod-local), replacing seed-provider links so a
 * fresh seat never runs on placeholder secrets; fail-soft — when a chain name
 * is absent the seat is skipped and its links are left untouched. Finally it
 * reconciles the resident ACTIVATIONS: for each agentId in the git-declared
 * ResidentActivations list, it sets the agent's body sandbox to resident mode
 * (`config.resident = { agentId }`) so activation is durable and re-asserted
 * every deploy, not a one-off manual flip (bodies run BEFORE activations so a
 * brand-new seat carries the recipe by the time its flag flips). A seeded
 * config whose agent is NOT in that list stays inert (the watchdog skips a
 * non-resident sandbox) — the inert-first pattern. Idempotent: collections are
 * create-if-absent, Functions/configs update only on drift, body recipes write
 * only on drift, provider chains replace only on drift (order-insensitive
 * compare), bindings are create-if-absent, and activations set only when the
 * flag is missing, so a re-run makes no changes.
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

  // The reconciles pass the full read-merged config; bridge its loose Record
  // type to the sandbox service's strict update-input type.
  const sandboxSlice = {
    get: (id: string) => db.services.sandbox.get(id),
    update: (data: { id: string; config: Record<string, any> }) =>
      db.services.sandbox.update(
        data as Parameters<typeof db.services.sandbox.update>[0]
      ),
  }

  console.log(`🧬 Reconciling resident body boot recipes from repo config...`)
  const bodySummary = await reconcileResidentBodies(
    { agent: db.services.agent, sandbox: sandboxSlice },
    (msg) => console.log(msg)
  )

  // Runner adapters for the chain reconcile: findByName resolves a provider by
  // its NAME (the only durable handle on out-of-band prod providers), and
  // replace swaps a sandbox's full provider-link set in one transaction. Ids
  // are never passed on insert — the sandbox_providers schema's entityId
  // default mints them (exactly how sandbox.addProvider inserts).
  const chainSlice = {
    agent: db.services.agent,
    provider: {
      findByName: async (name: string) => {
        try {
          const [row] = await db
            .select({ id: providers.id })
            .from(providers)
            .where(eq(providers.name, name))
            .limit(1)
          return { data: row ?? null }
        } catch (error: any) {
          return { data: null, error }
        }
      },
    },
    links: {
      list: async (sandboxId: string) => {
        try {
          const rows = await db
            .select({
              providerId: sandboxProviders.providerId,
              priority: sandboxProviders.priority,
            })
            .from(sandboxProviders)
            .where(eq(sandboxProviders.sandboxId, sandboxId))
          return {
            data: rows.map((r) => ({
              providerId: r.providerId,
              priority: r.priority ?? 0,
            })),
          }
        } catch (error: any) {
          return { error }
        }
      },
      replace: async (
        sandboxId: string,
        links: { providerId: string; priority: number }[]
      ) => {
        try {
          await db.transaction(async (tx) => {
            await tx
              .delete(sandboxProviders)
              .where(eq(sandboxProviders.sandboxId, sandboxId))
            if (links.length)
              await tx.insert(sandboxProviders).values(
                links.map((l) => ({
                  sandboxId,
                  providerId: l.providerId,
                  priority: l.priority,
                  model: null,
                }))
              )
          })
          return { error: null }
        } catch (error: any) {
          return { error }
        }
      },
    },
  }

  console.log(`🔗 Reconciling resident provider chains from repo config...`)
  const chainSummary = await reconcileResidentProviderChains(chainSlice, (msg) =>
    console.log(msg)
  )

  console.log(`🔌 Reconciling resident sandbox activations from repo config...`)
  const actSummary = await reconcileResidentActivations(
    { agent: db.services.agent, sandbox: sandboxSlice },
    (msg) => console.log(msg)
  )

  const errors =
    summary.errors +
    fnSummary.errors +
    cfgSummary.errors +
    bodySummary.errors +
    chainSummary.errors +
    actSummary.errors

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
  console.log(`   🧬 Body recipes asserted: ${bodySummary.asserted}`)
  console.log(`   ➖ Body recipes unchanged:${bodySummary.unchanged}`)
  console.log(`   🔗 Ops projects bound:    ${bodySummary.bound}`)
  console.log(`   🔗 Provider chains asserted: ${chainSummary.asserted}`)
  console.log(`   ➖ Provider chains unchanged:${chainSummary.unchanged}`)
  console.log(`   ⏭️  Provider chains skipped:  ${chainSummary.skipped}`)
  console.log(`   🔌 Activations set:       ${actSummary.activated}`)
  console.log(`   ➖ Activations unchanged: ${actSummary.unchanged}`)
  console.log(`   ❌ Errors:                ${errors}`)
  console.log(`═══════════════════════════════════════`)

  process.exit(errors > 0 ? 1 : 0)
}).catch((err: any) => {
  console.error(`Resident reconcile failed:`, err?.message)
  process.exit(1)
})

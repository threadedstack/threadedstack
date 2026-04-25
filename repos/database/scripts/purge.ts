import { database } from '@TDB/database'
import { Ids } from '@TDB/seeds/ids.seed'
import { ife } from '@keg-hub/jsutils/ife'

const db = database()

/**
 * Purge all seeded data by ID, in reverse FK dependency order
 *
 * Junction tables (agent_skills, agent_projects, agent_providers,
 * agent_functions, sandbox_projects, sandbox_providers) are handled
 * via CASCADE from their parent service deletes
 *
 * Does NOT touch:
 * - neon_auth.user (managed by Neon Auth — delete will fail if Neon ACLs block it)
 * - caddy_certmagic_objects (managed by Caddy)
 */

type SeedData = {
  name: string
  ids: string[]
  service: any
}

ife(async () => {
  console.log(`🧹 Starting database purge...`)
  console.log(``)

  const cleanOrder: SeedData[] = [
    // Leaf tables first
    { name: `quotas`, ids: Object.values(Ids.quota), service: db.services.quota },
    { name: `assets`, ids: Object.values(Ids.asset), service: db.services.asset },
    { name: `messages`, ids: Object.values(Ids.message), service: db.services.message },
    { name: `threads`, ids: Object.values(Ids.thread), service: db.services.thread },
    {
      name: `schedules`,
      ids: Object.values(Ids.schedule),
      service: db.services.schedule,
    },
    { name: `domains`, ids: Object.values(Ids.domain), service: db.services.domain },

    // Mid-level tables (delete referencing rows before referenced rows)
    { name: `skills`, ids: Object.values(Ids.skill), service: db.services.skill },
    { name: `agents`, ids: Object.values(Ids.agent), service: db.services.agent },
    {
      name: `functions`,
      ids: Object.values(Ids.function),
      service: db.services.function,
    },
    {
      name: `endpoints`,
      ids: Object.values(Ids.endpoint),
      service: db.services.endpoint,
    },
    { name: `apiKeys`, ids: Object.values(Ids.apikey), service: db.services.apiKey },
    { name: `secrets`, ids: Object.values(Ids.secret), service: db.services.secret },
    {
      name: `providers`,
      ids: Object.values(Ids.provider),
      service: db.services.provider,
    },
    {
      name: `invitations`,
      ids: Object.values(Ids.invitation),
      service: db.services.invitation,
    },
    {
      name: `subscriptions`,
      ids: Object.values(Ids.subscription),
      service: db.services.subscription,
    },
    { name: `sandboxes`, ids: Object.values(Ids.sandbox), service: db.services.sandbox },

    // Parent tables last
    { name: `projects`, ids: Object.values(Ids.project), service: db.services.project },
    { name: `roles`, ids: Object.values(Ids.role), service: db.services.role },
    { name: `organizations`, ids: Object.values(Ids.org), service: db.services.org },
    { name: `users`, ids: Object.values(Ids.user), service: db.services.user },
  ]

  let totalDeleted = 0
  let totalErrors = 0

  for (const seed of cleanOrder) {
    console.log(`🗑️  Cleaning ${seed.name}...`)

    for (const id of seed.ids) {
      try {
        const existing = await seed.service.get(id)

        if (existing.error || !existing.data) {
          console.log(`  ⏭️  Skipped ${seed.name}:${id} (not found)`)
        } else {
          const result = await seed.service.delete(id)
          if (result.error) {
            console.error(`  ❌ Failed to delete ${seed.name}:${id}`)
            console.error(`     Error:`, result.error.message)
            totalErrors++
          } else {
            console.log(`  ✅ Deleted ${seed.name}:${id}`)
            totalDeleted++
          }
        }
      } catch (error: any) {
        console.error(`  ❌ Error processing ${seed.name}:${id}`)
        console.error(`     Error:`, error.message)
        totalErrors++
      }
    }

    console.log(``)
  }

  console.log(`═══════════════════════════════════════`)
  console.log(`📊 Cleanup Summary:`)
  console.log(`   ✅ Deleted: ${totalDeleted}`)
  console.log(`   ❌ Errors:  ${totalErrors}`)
  console.log(`   🗑️  Total:   ${totalDeleted + totalErrors}`)
  console.log(`═══════════════════════════════════════`)
  console.log(``)
  console.log(`✨ Database cleanup complete!`)
  process.exit(0)
}).catch((err: any) => {
  console.error(`Cleanup failed:`, err.message)
  process.exit(1)
})

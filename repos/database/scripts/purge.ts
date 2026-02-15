import { database } from '@TDB/database'
import { Ids } from '@TDB/seeds/ids.seed'
import { ife } from '@keg-hub/jsutils/ife'

const db = database()

/**
 * Clean order is REVERSE of seed order to respect foreign key constraints
 *
 * Seed order:
 * 1. users
 * 2. organizations
 * 3. roles
 * 4. projects
 * 5. subscriptions
 * 6. invitations
 * 7. providers
 * 8. secrets
 * 9. apiKeys
 * 10. endpoints
 * 11. functions
 * 12. threads
 * 13. messages
 * 14. assets
 * 15. quotas
 *
 * Clean order (reverse):
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
    { name: `quotas`, ids: Object.values(Ids.quota), service: db.services.quota },
    {
      name: `assets`,
      ids: Object.values(Ids.asset),
      service: db.services.asset,
    },
    {
      name: `messages`,
      ids: Object.values(Ids.message),
      service: db.services.message,
    },
    {
      name: `threads`,
      ids: Object.values(Ids.thread),
      service: db.services.thread,
    },
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
    {
      name: `apiKeys`,
      ids: Object.values(Ids.apikey),
      service: db.services.apiKey,
    },
    {
      name: `secrets`,
      ids: Object.values(Ids.secret),
      service: db.services.secret,
    },
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
    {
      name: `projects`,
      ids: Object.values(Ids.project),
      service: db.services.project,
    },
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

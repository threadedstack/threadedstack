import { ife } from '@keg-hub/jsutils/ife'
import { database } from '@TDB/database'
import * as seeds from '@TDB/seeds'

const db = database()

/**
 * Seed loading order based on dependencies:
 * 1. users (no dependencies)
 * 2. organizations (no dependencies)
 * 3. roles (depends on users, organizations)
 * 4. projects (depends on organizations)
 * 5. subscriptions (depends on users)
 * 6. invitations (depends on organizations, users)
 * 7. providers (depends on users, organizations, projects)
 * 8. secrets (depends on organizations, projects, providers)
 * 9. configs (depends on users, organizations, projects)
 * 10. apiKeys (depends on organizations, projects)
 * 11. endpoints (depends on projects)
 * 12. functions (depends on projects, endpoints)
 * 13. threads (depends on users, providers, configs)
 * 14. messages (depends on threads)
 * 15. assets (depends on organizations, projects, users, threads, messages, providers)
 * 16. quotas (depends on organizations)
 */

type SeedData = {
  name: string
  data: any[]
  service: any
}

ife(async () => {
  console.log(`🌱 Starting database seeding...`)
  console.log(``)

  const seedOrder: SeedData[] = [
    { name: `users`, data: seeds.userSeeds, service: db.services.user },
    { name: `organizations`, data: seeds.orgsSeeds, service: db.services.org },
    { name: `roles`, data: seeds.rolesSeeds, service: db.services.role },
    { name: `projects`, data: seeds.projectsSeeds, service: db.services.project },
    {
      name: `subscriptions`,
      data: seeds.subscriptionsSeeds,
      service: db.services.subscription,
    },
    {
      name: `invitations`,
      data: seeds.invitationsSeeds,
      service: db.services.invitation,
    },
    { name: `providers`, data: seeds.providersSeeds, service: db.services.provider },
    { name: `secrets`, data: seeds.secretsSeeds, service: db.services.secret },
    { name: `configs`, data: seeds.configsSeeds, service: db.services.config },
    { name: `apiKeys`, data: seeds.apiKeysSeeds, service: db.services.apiKey },
    { name: `endpoints`, data: seeds.endpointsSeeds, service: db.services.endpoint },
    { name: `functions`, data: seeds.functionsSeeds, service: db.services.function },
    { name: `threads`, data: seeds.threadsSeeds, service: db.services.thread },
    { name: `messages`, data: seeds.messagesSeeds, service: db.services.message },
    { name: `assets`, data: seeds.assetsSeeds, service: db.services.asset },
    { name: `quotas`, data: seeds.quotasSeeds, service: db.services.quota },
  ]

  let totalCreated = 0
  let totalUpdated = 0
  let totalErrors = 0

  for (const seed of seedOrder) {
    console.log(`📦 Seeding ${seed.name}...`)

    for (const item of seed.data) {
      try {
        // Special handling for subscriptions due to unique userId constraint
        if (seed.name === `subscriptions`) {
          // Check if subscription exists for this user
          const existingByUser = await seed.service.findByUser(item.userId)

          if (existingByUser.error || !existingByUser.data) {
            // No subscription for this user, try to create
            const result = await seed.service.upsert(item)
            if (result.error) {
              console.error(`  ❌ Failed to create ${seed.name}:${item.id}`)
              console.error(`     Error:`, result.error.message)
              totalErrors++
            } else {
              console.log(`  ✅ Created ${seed.name}:${item.id}`)
              totalCreated++
            }
          } else {
            // Subscription exists for this user, update it
            const existingId = existingByUser.data.id
            const updateData = { ...item, id: existingId }
            const result = await seed.service.update(updateData)
            if (result.error) {
              console.error(`  ❌ Failed to update ${seed.name}:${existingId}`)
              console.error(`     Error:`, result.error.message)
              totalErrors++
            } else {
              console.log(`  🔄 Updated ${seed.name}:${existingId}`)
              totalUpdated++
            }
          }
        } else if (seed.name === `apiKeys`) {
          // Special handling for API keys - check by keyHash first
          // Use the getByHash method to find existing key
          const existingByKeyHash = await seed.service.getByHash(item.keyHash)

          if (existingByKeyHash.error || !existingByKeyHash.data) {
            // No API key with this keyHash, try to create
            const result = await seed.service.upsert(item)
            if (result.error) {
              console.error(`  ❌ Failed to create ${seed.name}:${item.id}`)
              console.error(`     Error:`, result.error.message)
              totalErrors++
            } else {
              console.log(`  ✅ Created ${seed.name}:${item.id}`)
              totalCreated++
            }
          } else {
            // API key exists with this keyHash, update it
            const existingId = existingByKeyHash.data.id
            const updateData = { ...item, id: existingId }
            const result = await seed.service.update(updateData)
            if (result.error) {
              console.error(`  ❌ Failed to update ${seed.name}:${existingId}`)
              console.error(`     Error:`, result.error.message)
              totalErrors++
            } else {
              console.log(`  🔄 Updated ${seed.name}:${existingId}`)
              totalUpdated++
            }
          }
        } else {
          // Standard handling for other entities
          const existing = await seed.service.get(item.id)

          if (existing.error) {
            // Record doesn't exist, create it
            const result = await seed.service.upsert(item)
            if (result.error) {
              console.error(`  ❌ Failed to create ${seed.name}:${item.id}`)
              console.error(`     Error:`, result.error.message)
              totalErrors++
            } else {
              console.log(`  ✅ Created ${seed.name}:${item.id}`)
              totalCreated++
            }
          } else {
            // Record exists, update it
            const result = await seed.service.update(item)
            if (result.error) {
              console.error(`  ❌ Failed to update ${seed.name}:${item.id}`)
              console.error(`     Error:`, result.error.message)
              totalErrors++
            } else {
              console.log(`  🔄 Updated ${seed.name}:${item.id}`)
              totalUpdated++
            }
          }
        }
      } catch (error: any) {
        console.error(`  ❌ Error processing ${seed.name}:${item.id}`)
        console.error(`     Error:`, error.message)
        totalErrors++
      }
    }

    console.log(``)
  }

  console.log(`═══════════════════════════════════════`)
  console.log(`📊 Seeding Summary:`)
  console.log(`   ✅ Created: ${totalCreated}`)
  console.log(`   🔄 Updated: ${totalUpdated}`)
  console.log(`   ❌ Errors:  ${totalErrors}`)
  console.log(`   📦 Total:   ${totalCreated + totalUpdated + totalErrors}`)
  console.log(`═══════════════════════════════════════`)
  console.log(``)
  console.log(`✨ Database seeding complete!`)
})

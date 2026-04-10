import { database } from '@TDB/database'
import { ife } from '@keg-hub/jsutils/ife'
import { loadEnvs } from '@tdsk/domain'

const nodeEnv = process.env.NODE_ENV || `local`

/*
 * Load the Envs for the configuration files from the repo root, and then add them to the process.
 * When running locally we want to make it easy to update the values by just changing the values.yml file
 * But in deployed envs, we want don't want to override the environments ENVs
 * So only pass true when in local, so the values.yml file becomes the source of truth
 */
loadEnvs({ force: nodeEnv === `local` })

const db = database()

/**
 * Fullorg seed script
 * Seeds a complete organization with all entity types from fullorg.ts
 *
 * Uses the agent service's built-in junction table handling for:
 * - agentProviders (via providerIds)
 * - agentProjects (via projects with per-project functionIds)
 *
 * Seed order respects foreign key dependencies:
 * 1. users, 2. org, 3. projects, 4. roles, 5. subscriptions,
 * 6. invitations, 7. providers (without secretId), 8. secrets (non-agent),
 * 8b. providers UPDATE (set secretId after secrets exist),
 * 9. apiKeys, 10. endpoints, 11. functions (endpoint + agent),
 * 12. agents (+ junction tables), 13. secrets (agent-scoped),
 * 14. skills, 14b. agentSkills junction, 15. threads,
 * 16. messages, 17. assets, 18. quotas, 19. sandboxes,
 * 20. schedules (after threads), 21. domains
 */

type SeedData = {
  name: string
  data: any[]
  service: any
}

/**
 * Convert fullorg Agent domain models to TAgentInsertOpts format
 * The agent service expects providerInputs and projects (with per-project functionIds)
 * instead of full Provider[]/Project[] arrays
 *
 * Merges projectConfigs into the projects array so functionIds and other
 * per-project overrides are passed to the agent service correctly
 */
const toAgentInsertOpts = (agent: any) => {
  const providerInputs = (agent.providers || []).map((p: any) => ({
    id: p.id,
    model: null,
  }))
  const projects = (agent.projects || []).map((p: any) => {
    const config = (agent.projectConfigs || []).find((c: any) => c.projectId === p.id)
    return {
      id: p.id,
      name: p.name,
      ...(config?.functionIds && { functionIds: config.functionIds }),
      ...(config?.model !== undefined && { model: config.model }),
      ...(config?.tools !== undefined && { tools: config.tools }),
      ...(config?.envVars !== undefined && { envVars: config.envVars }),
      ...(config?.environment !== undefined && { environment: config.environment }),
      ...(config?.systemPrompt !== undefined && { systemPrompt: config.systemPrompt }),
      ...(config?.maxTokens !== undefined && { maxTokens: config.maxTokens }),
      ...(config?.enabled !== undefined && { enabled: config.enabled }),
    }
  })

  return {
    projects,
    id: agent.id,
    providerInputs,
    name: agent.name,
    orgId: agent.orgId,
    model: agent.model,
    tools: agent.tools,
    active: agent.active,
    envVars: agent.envVars,
    maxTokens: agent.maxTokens,
    description: agent.description,
    environment: agent.environment,
    systemPrompt: agent.systemPrompt,
  }
}

let totalCreated = 0
let totalUpdated = 0
let totalErrors = 0

/**
 * Seed a single item using service methods
 * Handles create-or-update logic based on whether item exists
 */
const seedItem = async (seed: SeedData, item: any) => {
  try {
    if (seed.name === `subscriptions`) {
      const existingByUser = await seed.service.findByUser(item.userId)
      if (existingByUser.error || !existingByUser.data) {
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
        const existingId = existingByUser.data.id
        const result = await seed.service.update({ ...item, id: existingId })
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
      const existingByKeyHash = await seed.service.getByHash(item.keyHash)
      if (existingByKeyHash.error || !existingByKeyHash.data) {
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
        const existingId = existingByKeyHash.data.id
        const result = await seed.service.update({ ...item, id: existingId })
        if (result.error) {
          console.error(`  ❌ Failed to update ${seed.name}:${existingId}`)
          console.error(`     Error:`, result.error.message)
          totalErrors++
        } else {
          console.log(`  🔄 Updated ${seed.name}:${existingId}`)
          totalUpdated++
        }
      }
    } else if (seed.name === `agents`) {
      const existing = await seed.service.get(item.id)
      if (existing.error) {
        const result = await seed.service.create(item)
        if (result.error) {
          console.error(`  ❌ Failed to create ${seed.name}:${item.id}`)
          console.error(`     Error:`, result.error.message)
          totalErrors++
        } else {
          console.log(`  ✅ Created ${seed.name}:${item.id}`)
          totalCreated++
        }
      } else {
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
    } else {
      const existing = await seed.service.get(item.id)
      if (existing.error) {
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

ife(async () => {
  console.log(`🌱 Starting fullorg database seeding...`)
  console.log(``)

  // Dynamic import because fullorg.ts uses top-level await
  const { seeds } = await import('@TDB/seeds/fullorg')

  // Split secrets: agent-scoped secrets must come AFTER agents (FK dependency)
  const allSecrets = Object.values(seeds.secrets) as any[]
  const secretsPreAgent = allSecrets.filter((s: any) => !s.agentId)
  const secretsPostAgent = allSecrets.filter((s: any) => !!s.agentId)

  // Collect providers that have secretId for post-secret update
  const providersWithSecretId = Object.values(seeds.providers).filter(
    (p: any) => !!p.secretId
  )

  // Merge endpoint functions + agent functions into a single list
  const allFunctions = [
    ...Object.values(seeds.functions),
    ...Object.values(seeds.agentFunctions),
  ]

  const seedOrder: SeedData[] = [
    { name: `users`, data: Object.values(seeds.users), service: db.services.user },
    { name: `organizations`, data: [seeds.org], service: db.services.org },
    {
      name: `projects`,
      data: Object.values(seeds.projects),
      service: db.services.project,
    },
    {
      name: `roles`,
      data: [...Object.values(seeds.roles), ...Object.values(seeds.projectRoles)],
      service: db.services.role,
    },
    {
      name: `subscriptions`,
      data: Object.values(seeds.subscriptions),
      service: db.services.subscription,
    },
    {
      name: `invitations`,
      data: Object.values(seeds.invitations),
      service: db.services.invitation,
    },
    {
      name: `providers`,
      data: Object.values(seeds.providers),
      service: db.services.provider,
    },
    { name: `secrets`, data: secretsPreAgent, service: db.services.secret },
    { name: `apiKeys`, data: Object.values(seeds.apiKeys), service: db.services.apiKey },
    {
      name: `endpoints`,
      data: Object.values(seeds.endpoints),
      service: db.services.endpoint,
    },
    {
      name: `functions`,
      data: allFunctions,
      service: db.services.function,
    },
    {
      name: `agents`,
      data: Object.values(seeds.agents).map(toAgentInsertOpts),
      service: db.services.agent,
    },
    // Agent-scoped secrets must come after agents are created
    ...(secretsPostAgent.length
      ? [
          {
            name: `secrets (agent-scoped)`,
            data: secretsPostAgent,
            service: db.services.secret,
          },
        ]
      : []),
    {
      name: `skills`,
      data: Object.values(seeds.skills),
      service: db.services.skill,
    },
    { name: `threads`, data: Object.values(seeds.threads), service: db.services.thread },
    {
      name: `messages`,
      data: Object.values(seeds.messages),
      service: db.services.message,
    },
    { name: `assets`, data: Object.values(seeds.assets), service: db.services.asset },
    { name: `quotas`, data: Object.values(seeds.quotas), service: db.services.quota },
    {
      name: `sandboxes`,
      data: Object.values(seeds.sandboxes),
      service: db.services.sandbox,
    },
    {
      name: `schedules`,
      data: Object.values(seeds.schedules),
      service: db.services.schedule,
    },
    { name: `domains`, data: Object.values(seeds.domains), service: db.services.domain },
  ]

  for (const seed of seedOrder) {
    console.log(`📦 Seeding ${seed.name}...`)

    for (const item of seed.data) {
      await seedItem(seed, item)
    }

    console.log(``)
  }

  // Update providers with secretId now that secrets exist (resolves chicken-and-egg FK)
  if (providersWithSecretId.length) {
    console.log(`📦 Updating provider secretId links...`)
    for (const provider of providersWithSecretId) {
      try {
        const result = await db.services.provider.update(provider as any)
        if (result.error) {
          console.error(`  ❌ Failed to update provider secretId:${(provider as any).id}`)
          console.error(`     Error:`, result.error.message)
          totalErrors++
        } else {
          console.log(
            `  🔗 Linked provider:${(provider as any).id} → secret:${(provider as any).secretId}`
          )
          totalUpdated++
        }
      } catch (error: any) {
        console.error(`  ❌ Error updating provider:${(provider as any).id}`)
        console.error(`     Error:`, error.message)
        totalErrors++
      }
    }
    console.log(``)
  }

  // Link skills to agents via agentSkills junction table
  if (seeds.skillAgentLinks?.length) {
    console.log(`📦 Linking skills to agents...`)
    for (const link of seeds.skillAgentLinks) {
      try {
        const result = await db.services.skill.addAgent(link.skillId, link.agentId)
        if (result.error) {
          console.error(
            `  ❌ Failed to link skill:${link.skillId} → agent:${link.agentId}`
          )
          console.error(`     Error:`, result.error.message)
          totalErrors++
        } else {
          console.log(`  🔗 Linked skill:${link.skillId} → agent:${link.agentId}`)
          totalCreated++
        }
      } catch (error: any) {
        console.error(`  ❌ Error linking skill:${link.skillId} → agent:${link.agentId}`)
        console.error(`     Error:`, error.message)
        totalErrors++
      }
    }
    console.log(``)
  }

  console.log(`═══════════════════════════════════════`)
  console.log(`📊 Fullorg Seeding Summary:`)
  console.log(`   ✅ Created: ${totalCreated}`)
  console.log(`   🔄 Updated: ${totalUpdated}`)
  console.log(`   ❌ Errors:  ${totalErrors}`)
  console.log(`   📦 Total:   ${totalCreated + totalUpdated + totalErrors}`)
  console.log(`═══════════════════════════════════════`)
  console.log(``)
  console.log(`✨ Fullorg database seeding complete!`)
  process.exit(0)
}).catch((err: any) => {
  console.error(`Fullorg seeding failed:`, err.message)
  process.exit(1)
})

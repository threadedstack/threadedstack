import { Pool } from 'pg'
import { database } from '@TDB/database'
import { loadEnvs } from '@tdsk/domain'
import { ife } from '@keg-hub/jsutils/ife'
import { config } from '@TDB/configs/db.config'
import { scrypt, randomBytes } from 'node:crypto'
import { SeedPassword } from '@TDB/seeds/ids.seed'

const hashSeedPassword = (password: string): Promise<string> => {
  const salt = randomBytes(16).toString(`hex`)
  return new Promise((resolve, reject) => {
    scrypt(
      password.normalize(`NFKC`),
      salt,
      64,
      { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 },
      (err, key) => {
        if (err) reject(err)
        else resolve(salt + `:` + key.toString(`hex`))
      }
    )
  })
}

const reconcileUUID = async (
  pool: Pool,
  email: string,
  seedId: string,
  actualId: string
): Promise<boolean> => {
  await pool.query(`BEGIN`)
  try {
    await pool.query(
      `UPDATE neon_auth."user" SET email = email || '_SEED_SWAP' WHERE id = $1::uuid`,
      [actualId]
    )
    await pool.query(
      `INSERT INTO neon_auth."user" (id, name, email, "emailVerified", image, "createdAt", "updatedAt", role, banned, "banReason", "banExpires")
       SELECT $1::uuid, name, replace(email, '_SEED_SWAP', ''), "emailVerified", image, "createdAt", "updatedAt", role, banned, "banReason", "banExpires"
       FROM neon_auth."user" WHERE id = $2::uuid`,
      [seedId, actualId]
    )
    await pool.query(
      `UPDATE neon_auth.account SET "userId" = $1::uuid, "accountId" = $1 WHERE "userId" = $2::uuid`,
      [seedId, actualId]
    )
    await pool.query(
      `UPDATE neon_auth.session SET "userId" = $1::uuid WHERE "userId" = $2::uuid`,
      [seedId, actualId]
    )
    await pool.query(
      `UPDATE neon_auth.member SET "userId" = $1::uuid WHERE "userId" = $2::uuid`,
      [seedId, actualId]
    )
    await pool.query(
      `UPDATE neon_auth.invitation SET "inviterId" = $1::uuid WHERE "inviterId" = $2::uuid`,
      [seedId, actualId]
    )
    await pool.query(`DELETE FROM neon_auth."user" WHERE id = $1::uuid`, [actualId])
    await pool.query(`COMMIT`)
    return true
  } catch (err: any) {
    try {
      await pool.query(`ROLLBACK`)
    } catch {}
    console.error(`  ❌ UUID reconciliation failed for ${email}: ${err.message}`)
    return false
  }
}

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

type TSeedUser = {
  id: string
  email: string
  name: string
}

const registerSeedUsers = async (seedUsers: TSeedUser[]) => {
  const authUrl = process.env.TDSK_AUTH_URL
  if (!authUrl) {
    console.log(`  ⚠️  TDSK_AUTH_URL not set — skipping seed user credential registration`)
    console.log(``)
    return
  }

  const authHeaders = {
    'Content-Type': `application/json`,
    Origin: `http://localhost:5887`,
  }

  const pool = new Pool({ connectionString: config.url })

  try {
    for (const user of seedUsers) {
      try {
        const res = await fetch(`${authUrl}/sign-up/email`, {
          method: `POST`,
          headers: authHeaders,
          body: JSON.stringify({
            name: user.name,
            email: user.email,
            password: SeedPassword,
          }),
        })

        if (res.ok) {
          const data = (await res.json()) as { user?: { id?: string } }
          const neonUserId = data?.user?.id

          if (!neonUserId) {
            console.error(
              `  ❌ Sign-up succeeded for ${user.email} but response missing user ID`
            )
            continue
          }

          if (neonUserId !== user.id) {
            const ok = await reconcileUUID(pool, user.email, user.id, neonUserId)
            if (ok) console.log(`  ✅ Registered ${user.email} (UUID reconciled)`)
          } else {
            console.log(`  ✅ Registered ${user.email}`)
          }
        } else if (res.status === 422) {
          const signUpBody = (await res.json().catch(() => ({}))) as Record<string, any>
          const isUserExists =
            signUpBody?.code === `USER_ALREADY_EXISTS` ||
            String(signUpBody?.message || ``)
              .toLowerCase()
              .includes(`already exists`)

          if (!isUserExists) {
            console.warn(
              `  ⚠️  Sign-up validation error for ${user.email}: ${JSON.stringify(signUpBody).slice(0, 200)}`
            )
            continue
          }

          try {
            const existing = await pool.query(
              `SELECT id FROM neon_auth."user" WHERE email = $1`,
              [user.email]
            )
            const actualId = existing.rows[0]?.id
            if (actualId && actualId !== user.id) {
              const ok = await reconcileUUID(pool, user.email, user.id, actualId)
              if (ok)
                console.log(`  ✅ ${user.email} already registered (UUID reconciled)`)
            }
          } catch (err: any) {
            console.warn(`  ⚠️  Could not check UUID for ${user.email}: ${err.message}`)
          }

          const signInRes = await fetch(`${authUrl}/sign-in/email`, {
            method: `POST`,
            headers: authHeaders,
            body: JSON.stringify({ email: user.email, password: SeedPassword }),
          })

          if (signInRes.ok) {
            await signInRes.text()
            console.log(`  ✅ ${user.email} already registered with correct password`)
          } else {
            const signInStatus = signInRes.status
            await signInRes.text()

            if (signInStatus === 429 || signInStatus >= 500) {
              console.warn(
                `  ⚠️  Sign-in check returned ${signInStatus} for ${user.email} — skipping password update`
              )
              continue
            }

            try {
              const hash = await hashSeedPassword(SeedPassword)
              const updated = await pool.query(
                `UPDATE neon_auth.account SET password = $1, "updatedAt" = now() WHERE "userId" = $2::uuid AND "providerId" = 'credential'`,
                [hash, user.id]
              )
              if (updated.rowCount === 0) {
                const userExists = await pool.query(
                  `SELECT id FROM neon_auth."user" WHERE id = $1::uuid`,
                  [user.id]
                )
                if (userExists.rowCount === 0) {
                  console.warn(
                    `  ⚠️  No Neon Auth user record for ${user.email} — skipping credential insert`
                  )
                } else {
                  await pool.query(
                    `INSERT INTO neon_auth.account (id, "userId", "providerId", "accountId", password, "createdAt", "updatedAt")
                     VALUES (gen_random_uuid(), $1::uuid, 'credential', $1, $2, now(), now())`,
                    [user.id, hash]
                  )
                }
              }
              console.log(`  🔑 Updated password for ${user.email}`)
            } catch (err: any) {
              console.error(
                `  ❌ Failed to update password for ${user.email}: ${err.message}`
              )
            }
          }
        } else {
          const body = await res.text().catch(() => ``)
          console.warn(
            `  ⚠️  Sign-up failed for ${user.email} (${res.status}): ${body.slice(0, 200)}`
          )
        }
      } catch (err: any) {
        console.warn(`  ⚠️  Could not register ${user.email}: ${err.message}`)
      }
    }
  } finally {
    await pool.end()
  }

  console.log(``)
}

type SeedData = {
  name: string
  data: any[]
  service: any
}

/**
 * Convert fullorg Agent domain models to TAgentInsertOpts format
 * The agent service expects providerInputs and projects (with per-project functionIds)
 * instead of full TProviderLink[]/Project[] arrays
 *
 * Maps providerLinks (priority/provider/model) to providerInputs (id/model)
 * Merges projectConfigs into the projects array so functionIds and other
 * per-project overrides are passed to the agent service correctly
 */
const toAgentInsertOpts = (agent: any) => {
  const providerInputs = (agent.providerLinks || []).map((link: any) => ({
    id: link.provider?.id ?? link.id,
    model: link.model ?? null,
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
      if (existing.error || !existing.data) {
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
      if (existing.error || !existing.data) {
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

  // Register seed user credentials with Neon Auth (email/password sign-up)
  console.log(`🔐 Registering seed user credentials...`)
  const seedUsers = Object.values(seeds.users).map((u: any) => ({
    id: u.id,
    name: u.name,
    email: u.email,
  }))
  await registerSeedUsers(seedUsers)

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
      data: Object.values(seeds.providers).map((p: any) => ({ ...p, secretId: null })),
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
          console.error(
            `     Error:`,
            result.error.cause?.message || result.error.message
          )
          totalErrors++
        } else {
          console.log(`  🔗 Linked skill:${link.skillId} → agent:${link.agentId}`)
          totalCreated++
        }
      } catch (error: any) {
        console.error(`  ❌ Error linking skill:${link.skillId} → agent:${link.agentId}`)
        console.error(`     Error:`, error.cause?.message || error.message)
        totalErrors++
      }
    }
    console.log(``)
  }

  // Link providers to sandboxes via sandboxProviders junction table
  if (seeds.sandboxProviderLinks?.length) {
    console.log(`📦 Linking providers to sandboxes...`)
    for (const link of seeds.sandboxProviderLinks) {
      try {
        const result = await db.services.sandbox.addProvider(
          link.sandboxId,
          link.providerId,
          link.priority
        )
        if (result.error) {
          console.error(
            `  ❌ Failed to link sandbox:${link.sandboxId} → provider:${link.providerId}`
          )
          console.error(
            `     Error:`,
            result.error.cause?.message || result.error.message
          )
          totalErrors++
        } else {
          console.log(
            `  🔗 Linked sandbox:${link.sandboxId} → provider:${link.providerId} (priority:${link.priority})`
          )
          totalCreated++
        }
      } catch (error: any) {
        console.error(
          `  ❌ Error linking sandbox:${link.sandboxId} → provider:${link.providerId}`
        )
        console.error(`     Error:`, error.cause?.message || error.message)
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

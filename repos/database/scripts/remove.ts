import { config } from '@TDB/configs/db.config'
import { Pool } from 'pg'
import { ife } from '@keg-hub/jsutils/ife'

/**
 * Drops ALL Drizzle-managed tables with CASCADE
 * This removes all data, indexes, constraints, and the tables themselves
 * After running, use `pnpm push` to recreate tables from Drizzle schemas
 *
 * Does NOT touch:
 * - neon_auth.user (managed by Neon Auth)
 * - caddy_certmagic_objects (managed by Caddy)
 */

const tables = [
  // Leaf / junction tables first
  `quotas`,
  `assets`,
  `memories`,
  `messages`,
  `threads`,
  `schedules`,
  `invoices`,
  `agent_functions`,
  `agent_providers`,
  `agent_projects`,
  `agent_skills`,
  `sandbox_projects`,
  `sandbox_providers`,
  // Mid-level tables
  `functions`,
  `endpoints`,
  `api_keys`,
  `secrets`,
  `providers`,
  `invitations`,
  `subscriptions`,
  `agents`,
  `skills`,
  `sandboxes`,
  `domains`,
  // Parent tables
  `projects`,
  `roles`,
  `organizations`,
]

ife(async () => {
  const pool = new Pool({ connectionString: config.url })

  console.log(`Starting full database drop...`)
  console.log(`Dropping ${tables.length} tables with CASCADE...\n`)

  const sql = `DROP TABLE IF EXISTS ${tables.join(', ')} CASCADE;`
  console.log(`SQL: ${sql}\n`)

  await pool.query(sql)

  console.log(`All tables dropped successfully.`)
  console.log(`Run \`pnpm push\` to recreate tables from Drizzle schemas.`)
  console.log(`Run \`pnpm seed\` to re-seed data (optional).`)

  await pool.end()
  process.exit(0)
}).catch((err: any) => {
  console.error(`Drop failed:`, err.message)
  process.exit(1)
})

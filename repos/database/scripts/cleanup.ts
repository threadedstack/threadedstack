import { Pool } from 'pg'
import { Ids } from '@TDB/seeds/ids.seed'
import { ife } from '@keg-hub/jsutils/ife'
import { config } from '@TDB/configs/db.config'

/**
 * Cleanup and remove all non-seed data from the database
 * Preserves rows whose IDs match predefined seeds in ids.seed.ts
 * Deletes in reverse FK dependency order (children before parents)
 *
 * Does NOT touch:
 * - neon_auth.user (managed by Neon Auth)
 * - caddy_certmagic_objects (managed by Caddy)
 */

const agentIds = Object.values(Ids.agent)

type CleanEntry = {
  table: string
  seedIds?: string[]
  fkColumn?: string
}

const cleanOrder: CleanEntry[] = [
  // Leaf tables first
  { table: `quotas`, seedIds: Object.values(Ids.quota) },
  { table: `assets`, seedIds: Object.values(Ids.asset) },
  { table: `messages`, seedIds: Object.values(Ids.message) },
  { table: `threads`, seedIds: Object.values(Ids.thread) },
  { table: `schedules` },
  { table: `invoices` },

  // Junction tables — filter by agent_id
  { table: `agent_skills`, fkColumn: `agent_id`, seedIds: agentIds },
  { table: `agent_functions`, fkColumn: `agent_id`, seedIds: agentIds },
  { table: `agent_providers`, fkColumn: `agent_id`, seedIds: agentIds },
  { table: `agent_projects`, fkColumn: `agent_id`, seedIds: agentIds },

  // Sandbox junction tables
  { table: `sandbox_projects` },
  { table: `sandbox_providers` },

  // Mid-level tables
  { table: `functions`, seedIds: Object.values(Ids.function) },
  { table: `endpoints`, seedIds: Object.values(Ids.endpoint) },
  { table: `api_keys`, seedIds: Object.values(Ids.apikey) },
  { table: `secrets`, seedIds: Object.values(Ids.secret) },
  { table: `providers`, seedIds: Object.values(Ids.provider) },
  { table: `invitations`, seedIds: Object.values(Ids.invitation) },
  { table: `subscriptions`, seedIds: Object.values(Ids.subscription) },
  { table: `agents`, seedIds: agentIds },
  { table: `domains`, seedIds: Object.values(Ids.domain) },
  { table: `sandboxes` },
  { table: `skills` },

  // Parent tables last
  { table: `projects`, seedIds: Object.values(Ids.project) },
  { table: `roles`, seedIds: Object.values(Ids.role) },
  { table: `organizations`, seedIds: Object.values(Ids.org) },
]

const buildDeleteQuery = (entry: CleanEntry) => {
  const { table, seedIds, fkColumn } = entry

  // No seed IDs — delete all rows
  if (!seedIds || seedIds.length === 0) {
    return { text: `DELETE FROM ${table}`, values: [] }
  }

  const column = fkColumn || `id`
  const placeholders = seedIds.map((_, i) => `$${i + 1}`)

  return {
    text: `DELETE FROM ${table} WHERE ${column} NOT IN (${placeholders.join(`, `)})`,
    values: seedIds,
  }
}

ife(async () => {
  const pool = new Pool({ connectionString: config.url })

  console.log(`Starting database cleanup (preserving seed data)...`)
  console.log(``)

  let totalDeleted = 0
  let totalErrors = 0

  for (const entry of cleanOrder) {
    try {
      const query = buildDeleteQuery(entry)
      const result = await pool.query(query.text, query.values)
      const count = result.rowCount ?? 0
      totalDeleted += count

      if (count > 0) {
        console.log(`  Cleaned ${entry.table}: ${count} rows removed`)
      } else {
        console.log(`  Skipped ${entry.table}: no test data found`)
      }
    } catch (error: any) {
      // Table may not exist yet — not an error worth failing over
      if (error.code === `42P01`) {
        console.log(`  Skipped ${entry.table}: table does not exist`)
      } else {
        console.error(`  FAILED ${entry.table}: ${error.message}`)
        totalErrors++
      }
    }
  }

  console.log(``)
  console.log(`Cleanup complete: ${totalDeleted} rows removed, ${totalErrors} errors`)

  await pool.end()
  process.exit(totalErrors > 0 ? 1 : 0)
}).catch((err: any) => {
  console.error(`Cleanup failed:`, err.message)
  process.exit(1)
})

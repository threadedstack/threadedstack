import { sql } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { repos } from '@TDB/schemas/repos'
import { base } from '@TDB/utils/schema/base'
import { uuid, jsonb, check, pgTable } from 'drizzle-orm/pg-core'

export const configs = pgTable(
  'configs',
  {
    ...base,
    data: jsonb(`data`).notNull(),
    userId: uuid(`user_id`).references(() => users.id, { onDelete: `cascade` }),
    orgId: uuid(`org_id`).references(() => orgs.id, { onDelete: `cascade` }),
    repoId: uuid(`repo_id`).references(() => repos.id, { onDelete: `cascade` }),
  },
  (table) => [
    // CHANGE: Array syntax
    check(
      `config_owner_check`,
      sql`
    (
      (${table.userId} IS NOT NULL)::int + 
      (${table.orgId} IS NOT NULL)::int + 
      (${table.repoId} IS NOT NULL)::int
    ) = 1
  `
    ),
  ]
)

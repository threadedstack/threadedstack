import { sql } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { projects } from '@TDB/schemas/projects'
import { base } from '@TDB/utils/schema/base'
import { uuid, jsonb, check, pgTable } from 'drizzle-orm/pg-core'

export const configs = pgTable(
  `configs`,
  {
    ...base,
    data: jsonb(`data`).notNull(),
    userId: uuid(`user_id`).references(() => users.id, { onDelete: `cascade` }),
    orgId: uuid(`org_id`).references(() => orgs.id, { onDelete: `cascade` }),
    projectId: uuid(`project_id`).references(() => projects.id, { onDelete: `cascade` }),
  },
  (table) => [
    check(
      `config_owner_check`,
      sql`
    (
      (${table.userId} IS NOT NULL)::int + 
      (${table.orgId} IS NOT NULL)::int + 
      (${table.projectId} IS NOT NULL)::int
    ) = 1
  `
    ),
  ]
)

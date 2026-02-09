import { sql, relations } from 'drizzle-orm'
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

export const configsRelations = relations(configs, ({ one }) => ({
  user: one(users, { fields: [configs.userId], references: [users.id] }),
  org: one(orgs, { fields: [configs.orgId], references: [orgs.id] }),
  project: one(projects, { fields: [configs.projectId], references: [projects.id] }),
}))

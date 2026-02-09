import { sql, relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { projects } from '@TDB/schemas/projects'
import { users } from '@TDB/schemas/users'
import { base } from '@TDB/utils/schema/base'
import { uuid, jsonb, pgTable, text, check } from 'drizzle-orm/pg-core'

export const providers = pgTable(
  `providers`,
  {
    ...base,
    name: text(`name`),
    options: jsonb(`options`),
    type: text(`type`).notNull(),
    projectId: uuid(`project_id`).references(() => projects.id, { onDelete: `cascade` }),
    orgId: uuid(`org_id`).references(() => orgs.id, { onDelete: `cascade` }),
    userId: uuid(`user_id`).references(() => users.id, { onDelete: `cascade` }),
  },
  (table) => [
    check(
      `provider_owner_check`,
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

export const providersRelations = relations(providers, ({ one }) => ({
  org: one(orgs, { fields: [providers.orgId], references: [orgs.id] }),
  user: one(users, { fields: [providers.userId], references: [users.id] }),
  project: one(projects, { fields: [providers.projectId], references: [projects.id] }),
}))

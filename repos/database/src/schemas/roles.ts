import { sql, relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { projects } from '@TDB/schemas/projects'
import { base } from '@TDB/utils/schema/base'
import { uuid, text, check, pgTable } from 'drizzle-orm/pg-core'

export const roles = pgTable(
  `roles`,
  {
    ...base,
    name: text(`name`),
    type: text(`type`).notNull(),
    orgId: uuid(`org_id`).references(() => orgs.id, { onDelete: `cascade` }),
    projectId: uuid(`project_id`).references(() => projects.id, { onDelete: `cascade` }),
    userId: uuid(`user_id`)
      .references(() => users.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    check(
      `role_scope_check`,
      sql`
    (${table.orgId} IS NOT NULL AND ${table.projectId} IS NULL) OR 
    (${table.orgId} IS NULL AND ${table.projectId} IS NOT NULL)
  `
    ),
  ]
)

export const rolesRelations = relations(roles, ({ one }) => ({
  user: one(users, { fields: [roles.userId], references: [users.id] }),
  org: one(orgs, { fields: [roles.orgId], references: [orgs.id] }),
  project: one(projects, { fields: [roles.projectId], references: [projects.id] }),
}))

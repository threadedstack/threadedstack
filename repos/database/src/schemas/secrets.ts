import { orgs } from '@TDB/schemas/orgs'
import { base } from '@TDB/utils/schema/base'
import { sql, relations } from 'drizzle-orm'
import { projects } from '@TDB/schemas/projects'
import { providers } from '@TDB/schemas/providers'
import { uuid, text, check, pgTable } from 'drizzle-orm/pg-core'

export const secrets = pgTable(
  `secrets`,
  {
    ...base,
    name: text(`name`).notNull(),
    description: text(`description`),
    hashKey: text(`hash_key`).notNull(),
    encryptedValue: text(`encrypted_value`).notNull(),
    orgId: uuid(`org_id`).references(() => orgs.id, { onDelete: `cascade` }),
    projectId: uuid(`project_id`).references(() => projects.id, { onDelete: `cascade` }),
    providerId: uuid(`provider_id`).references(() => providers.id, {
      onDelete: `cascade`,
    }),
  },
  (table) => [
    check(
      `secret_scope_check`,
      sql`
    (${table.orgId} IS NOT NULL AND ${table.projectId} IS NULL) OR 
    (${table.orgId} IS NULL AND ${table.projectId} IS NOT NULL) OR 
    (${table.orgId} IS NULL AND ${table.providerId} IS NOT NULL)
  `
    ),
  ]
)

export const secretsRelations = relations(secrets, ({ one }) => ({
  org: one(orgs, { fields: [secrets.orgId], references: [orgs.id] }),
  project: one(projects, { fields: [secrets.projectId], references: [projects.id] }),
}))

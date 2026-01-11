import { orgs } from '@TDB/schemas/orgs'
import { repos } from '@TDB/schemas/repos'
import { base } from '@TDB/utils/schema/base'
import { sql, relations } from 'drizzle-orm'
import { providers } from '@TDB/schemas/providers'
import { uuid, text, check, pgTable } from 'drizzle-orm/pg-core'

export const secrets = pgTable(
  `secrets`,
  {
    ...base,
    name: text(`name`).notNull(),
    hashKey: text(`hash_key`).notNull(),
    encryptedValue: text(`encrypted_value`).notNull(),
    orgId: uuid(`org_id`).references(() => orgs.id, { onDelete: `cascade` }),
    repoId: uuid(`repo_id`).references(() => repos.id, { onDelete: `cascade` }),
    providerId: uuid(`provider_id`).references(() => providers.id, {
      onDelete: `cascade`,
    }),
  },
  (table) => [
    check(
      `secret_scope_check`,
      sql`
    (${table.orgId} IS NOT NULL AND ${table.repoId} IS NULL) OR 
    (${table.orgId} IS NULL AND ${table.repoId} IS NOT NULL) OR 
    (${table.orgId} IS NULL AND ${table.providerId} IS NOT NULL)
  `
    ),
  ]
)

export const secretsRelations = relations(secrets, ({ one }) => ({
  org: one(orgs, { fields: [secrets.orgId], references: [orgs.id] }),
  repo: one(repos, { fields: [secrets.repoId], references: [repos.id] }),
}))

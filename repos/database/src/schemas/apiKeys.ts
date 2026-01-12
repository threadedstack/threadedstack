import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { projects } from '@TDB/schemas/projects'
import { base } from '@TDB/utils/schema/base'
import {
  uuid,
  text,
  index,
  integer,
  varchar,
  pgTable,
  boolean,
  timestamp,
} from 'drizzle-orm/pg-core'

export const apiKeys = pgTable(
  `api_keys`,
  {
    ...base,
    name: text(`name`).notNull(),
    expiresAt: timestamp(`expires_at`),
    lastUsedAt: timestamp(`last_used_at`),
    scopes: text(`scopes`).default(`read`),
    active: boolean(`active`).default(true),
    rateLimit: integer(`rate_limit`).default(100),
    keyHash: text(`key_hash`).notNull().unique(),
    keyPrefix: varchar(`key_prefix`, { length: 12 }).notNull(),
    orgId: uuid(`org_id`).references(() => orgs.id, { onDelete: `cascade` }),
    projectId: uuid(`project_id`).references(() => projects.id, { onDelete: `cascade` }),
  },
  (table) => [
    index(`api_keys_org_id_idx`).on(table.orgId),
    index(`api_keys_project_id_idx`).on(table.projectId),
    index(`api_keys_key_hash_idx`).on(table.keyHash),
  ]
)

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  org: one(orgs, { fields: [apiKeys.orgId], references: [orgs.id] }),
  project: one(projects, { fields: [apiKeys.projectId], references: [projects.id] }),
}))

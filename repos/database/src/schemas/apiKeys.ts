import type { TPermission } from '@tdsk/domain'

import { sql } from 'drizzle-orm'
import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { agents } from '@TDB/schemas/agents'
import { base } from '@TDB/utils/schema/base'
import { ApiKeyIdPrefix } from '@tdsk/domain'
import { projects } from '@TDB/schemas/projects'
import { entityId } from '@TDB/utils/schema/entityId'
import {
  uuid,
  text,
  check,
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
    id: entityId(ApiKeyIdPrefix),
    name: text(`name`).notNull(),
    expiresAt: timestamp(`expires_at`),
    lastUsedAt: timestamp(`last_used_at`),
    active: boolean(`active`).default(true),
    rateLimit: integer(`rate_limit`).default(100),
    keyHash: text(`key_hash`).notNull().unique(),
    keyPrefix: varchar(`key_prefix`, { length: 12 }).notNull(),
    permissions: text(`permissions`).array().$type<TPermission[]>(),
    orgId: varchar(`org_id`, { length: 10 }).references(() => orgs.id, {
      onDelete: `cascade`,
    }),
    projectId: varchar(`project_id`, { length: 10 }).references(() => projects.id, {
      onDelete: `cascade`,
    }),
    userId: uuid(`user_id`).references(() => users.id, { onDelete: `cascade` }),
    /** Resident-bound key: authorizes ONLY the resident dispatch surface for
     * this agent (minted/rotated by mintResidentToken at resident pod start) */
    residentAgentId: varchar(`resident_agent_id`, { length: 10 }).references(
      () => agents.id,
      { onDelete: `cascade` }
    ),
  },
  (table) => [
    index(`api_keys_org_id_idx`).on(table.orgId),
    index(`api_keys_key_hash_idx`).on(table.keyHash),
    index(`api_keys_project_id_idx`).on(table.projectId),
    index(`api_keys_user_id_idx`).on(table.userId),
    index(`api_keys_resident_agent_id_idx`).on(table.residentAgentId),
    check(
      `api_key_scope_check`,
      sql`
    (${table.orgId} IS NOT NULL AND ${table.projectId} IS NULL)
    OR (${table.orgId} IS NULL AND ${table.projectId} IS NOT NULL)
    OR (${table.orgId} IS NULL AND ${table.projectId} IS NULL)
  `
    ),
  ]
)

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  org: one(orgs, { fields: [apiKeys.orgId], references: [orgs.id] }),
  project: one(projects, { fields: [apiKeys.projectId], references: [projects.id] }),
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
  residentAgent: one(agents, {
    fields: [apiKeys.residentAgentId],
    references: [agents.id],
  }),
}))

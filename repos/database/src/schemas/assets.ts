import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { sql, relations } from 'drizzle-orm'
import { AssetIdPrefix } from '@tdsk/domain'
import { base } from '@TDB/utils/schema/base'
import { threads } from '@TDB/schemas/threads'
import { messages } from '@TDB/schemas/messages'
import { projects } from '@TDB/schemas/projects'
import { providers } from '@TDB/schemas/providers'
import { entityId } from '@TDB/utils/schema/entityId'
import { uuid, text, jsonb, check, index, pgTable, varchar } from 'drizzle-orm/pg-core'

export const assets = pgTable(
  `assets`,
  {
    ...base,
    id: entityId(AssetIdPrefix),
    url: text(`url`),
    meta: jsonb(`meta`),
    content: jsonb(`content`),
    name: text(`name`).notNull(),
    type: text(`type`).notNull(),
    providerId: varchar(`provider_id`, { length: 10 }).references(() => providers.id, {
      onDelete: `set null`,
    }),
    orgId: varchar(`org_id`, { length: 10 }).references(() => orgs.id, {
      onDelete: `cascade`,
    }),
    userId: uuid(`user_id`).references(() => users.id, { onDelete: `cascade` }),
    threadId: varchar(`thread_id`, { length: 10 }).references(() => threads.id, {
      onDelete: `cascade`,
    }),
    projectId: varchar(`project_id`, { length: 10 }).references(() => projects.id, {
      onDelete: `cascade`,
    }),
    messageId: varchar(`message_id`, { length: 10 }).references(() => messages.id, {
      onDelete: `cascade`,
    }),
  },
  (table) => [
    check(
      `asset_owner_check`,
      sql`
    (
      (${table.orgId} IS NOT NULL)::int +
      (${table.projectId} IS NOT NULL)::int +
      (${table.userId} IS NOT NULL)::int +
      (${table.threadId} IS NOT NULL)::int +
      (${table.messageId} IS NOT NULL)::int
    ) = 1
  `
    ),
    index(`assets_org_id_idx`).on(table.orgId),
    index(`assets_thread_id_idx`).on(table.threadId),
    index(`assets_project_id_idx`).on(table.projectId),
    index(`assets_message_id_idx`).on(table.messageId),
  ]
)

export const assetsRelations = relations(assets, ({ one }) => ({
  org: one(orgs, { fields: [assets.orgId], references: [orgs.id] }),
  project: one(projects, { fields: [assets.projectId], references: [projects.id] }),
  user: one(users, { fields: [assets.userId], references: [users.id] }),
  thread: one(threads, { fields: [assets.threadId], references: [threads.id] }),
  message: one(messages, { fields: [assets.messageId], references: [messages.id] }),
  provider: one(providers, { fields: [assets.providerId], references: [providers.id] }),
}))

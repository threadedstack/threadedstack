import { sql, relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { base } from '@TDB/utils/schema/base'
import { threads } from '@TDB/schemas/threads'
import { messages } from '@TDB/schemas/messages'
import { projects } from '@TDB/schemas/projects'
import { providers } from '@TDB/schemas/providers'
import { uuid, text, jsonb, check, pgTable } from 'drizzle-orm/pg-core'

export const assets = pgTable(
  `assets`,
  {
    ...base,
    url: text(`url`),
    meta: jsonb(`meta`),
    content: jsonb(`content`),
    name: text(`name`).notNull(),
    type: text(`type`).notNull(),
    providerId: uuid(`provider_id`).references(() => providers.id, {
      onDelete: `set null`,
    }),
    orgId: uuid(`org_id`).references(() => orgs.id, { onDelete: `cascade` }),
    userId: uuid(`user_id`).references(() => users.id, { onDelete: `cascade` }),
    threadId: uuid(`thread_id`).references(() => threads.id, { onDelete: `cascade` }),
    projectId: uuid(`project_id`).references(() => projects.id, { onDelete: `cascade` }),
    messageId: uuid(`message_id`).references(() => messages.id, { onDelete: `cascade` }),
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

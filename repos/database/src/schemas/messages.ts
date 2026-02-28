import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { assets } from '@TDB/schemas/assets'
import { base } from '@TDB/utils/schema/base'
import { threads } from '@TDB/schemas/threads'
import { projects } from '@TDB/schemas/projects'
import { text, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core'

export const messages = pgTable(`messages`, {
  ...base,
  meta: jsonb(`meta`),
  type: text(`type`).notNull(),
  content: jsonb(`content`).notNull(),
  orgId: varchar(`org_id`, { length: 10 }).references(() => orgs.id, {
    onDelete: `cascade`,
  }),
  projectId: varchar(`project_id`, { length: 10 }).references(() => projects.id, {
    onDelete: `cascade`,
  }),
  threadId: varchar(`thread_id`, { length: 10 })
    .references(() => threads.id, { onDelete: `cascade` })
    .notNull(),
})

export const messagesRelations = relations(messages, ({ one, many }) => ({
  assets: many(assets),
  thread: one(threads, { fields: [messages.threadId], references: [threads.id] }),
  org: one(orgs, { fields: [messages.orgId], references: [orgs.id] }),
  project: one(projects, { fields: [messages.projectId], references: [projects.id] }),
}))

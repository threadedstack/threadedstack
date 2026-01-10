import { relations } from 'drizzle-orm'
import { assets } from '@TDB/schemas/assets'
import { base } from '@TDB/utils/schema/base'
import { threads } from '@TDB/schemas/threads'
import { uuid, text, jsonb, pgTable } from 'drizzle-orm/pg-core'

export const messages = pgTable(`messages`, {
  ...base,
  meta: jsonb(`meta`),
  type: text(`type`).notNull(),
  content: jsonb(`content`).notNull(),
  threadId: uuid(`thread_id`)
    .references(() => threads.id, { onDelete: `cascade` })
    .notNull(),
})

export const messagesRelations = relations(messages, ({ one, many }) => ({
  assets: many(assets),
  thread: one(threads, { fields: [messages.threadId], references: [threads.id] }),
}))

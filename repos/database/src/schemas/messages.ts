import { relations } from 'drizzle-orm'
import { assets } from '@TDB/schemas/assets'
import { base } from '@TDB/utils/schema/base'
import { threads } from '@TDB/schemas/threads'
import { uuid, jsonb, pgEnum, pgTable } from 'drizzle-orm/pg-core'

export const messageTypeEnum = pgEnum(`message_type`, [
  `user`,
  `assistant`,
  `system`,
  `tool`,
  `action`,
])

export const messages = pgTable(`messages`, {
  ...base,
  meta: jsonb(`meta`),
  content: jsonb(`content`).notNull(),
  type: messageTypeEnum(`type`).notNull(),
  threadId: uuid(`thread_id`)
    .references(() => threads.id, { onDelete: `cascade` })
    .notNull(),
})

export const messagesRelations = relations(messages, ({ one, many }) => ({
  assets: many(assets),
  thread: one(threads, { fields: [messages.threadId], references: [threads.id] }),
}))

import { relations } from 'drizzle-orm'
import { users } from '@TDB/schemas/users'
import { base } from '@TDB/utils/schema/base'
import { configs } from '@TDB/schemas/configs'
import { messages } from '@TDB/schemas/messages'
import { providers } from '@TDB/schemas/providers'
import { uuid, text, jsonb, boolean, pgTable } from 'drizzle-orm/pg-core'

export const threads = pgTable(`threads`, {
  ...base,
  name: text(`name`),
  meta: jsonb(`meta`),
  public: boolean(`public`).default(false),
  configId: uuid(`config_id`).references(() => configs.id),
  providerId: uuid(`provider_id`).references(() => providers.id),
  userId: uuid(`user_id`)
    .references(() => users.id, { onDelete: `cascade` })
    .notNull(),
})

export const threadsRelations = relations(threads, ({ one, many }) => ({
  messages: many(messages),
  user: one(users, { fields: [threads.userId], references: [users.id] }),
  config: one(configs, { fields: [threads.configId], references: [configs.id] }),
  provider: one(providers, { fields: [threads.providerId], references: [providers.id] }),
}))

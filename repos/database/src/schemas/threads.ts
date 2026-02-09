import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { base } from '@TDB/utils/schema/base'
import { configs } from '@TDB/schemas/configs'
import { messages } from '@TDB/schemas/messages'
import { projects } from '@TDB/schemas/projects'
import { providers } from '@TDB/schemas/providers'
import { uuid, text, jsonb, boolean, index, pgTable } from 'drizzle-orm/pg-core'

export const threads = pgTable(
  `threads`,
  {
    ...base,
    name: text(`name`),
    meta: jsonb(`meta`),
    public: boolean(`public`).default(false),
    configId: uuid(`config_id`).references(() => configs.id, { onDelete: `set null` }),
    providerId: uuid(`provider_id`).references(() => providers.id, {
      onDelete: `set null`,
    }),
    orgId: uuid(`org_id`).references(() => orgs.id, { onDelete: `cascade` }),
    projectId: uuid(`project_id`).references(() => projects.id, { onDelete: `cascade` }),
    userId: uuid(`user_id`)
      .references(() => users.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [index(`threads_user_id_idx`).on(table.userId)]
)

export const threadsRelations = relations(threads, ({ one, many }) => ({
  messages: many(messages),
  user: one(users, { fields: [threads.userId], references: [users.id] }),
  config: one(configs, { fields: [threads.configId], references: [configs.id] }),
  provider: one(providers, { fields: [threads.providerId], references: [providers.id] }),
  org: one(orgs, { fields: [threads.orgId], references: [orgs.id] }),
  project: one(projects, { fields: [threads.projectId], references: [projects.id] }),
}))

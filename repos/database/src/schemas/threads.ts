import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { base } from '@TDB/utils/schema/base'
import { agents } from '@TDB/schemas/agents'
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
    parentThreadId: uuid(`parent_thread_id`),
    branchMessageId: uuid(`branch_message_id`),
    configId: uuid(`config_id`).references(() => configs.id, { onDelete: `set null` }),
    providerId: uuid(`provider_id`).references(() => providers.id, {
      onDelete: `set null`,
    }),
    agentId: uuid(`agent_id`).references(() => agents.id, { onDelete: `set null` }),
    orgId: uuid(`org_id`).references(() => orgs.id, { onDelete: `cascade` }),
    projectId: uuid(`project_id`).references(() => projects.id, { onDelete: `cascade` }),
    userId: uuid(`user_id`)
      .references(() => users.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    index(`threads_user_id_idx`).on(table.userId),
    index(`threads_agent_id_idx`).on(table.agentId),
    index(`threads_parent_thread_id_idx`).on(table.parentThreadId),
  ]
)

export const threadsRelations = relations(threads, ({ one, many }) => ({
  messages: many(messages),
  user: one(users, { fields: [threads.userId], references: [users.id] }),
  config: one(configs, { fields: [threads.configId], references: [configs.id] }),
  provider: one(providers, { fields: [threads.providerId], references: [providers.id] }),
  agent: one(agents, { fields: [threads.agentId], references: [agents.id] }),
  org: one(orgs, { fields: [threads.orgId], references: [orgs.id] }),
  project: one(projects, { fields: [threads.projectId], references: [projects.id] }),
  parentThread: one(threads, {
    fields: [threads.parentThreadId],
    references: [threads.id],
    relationName: `threadBranches`,
  }),
  branches: many(threads, { relationName: `threadBranches` }),
  branchMessage: one(messages, {
    fields: [threads.branchMessageId],
    references: [messages.id],
  }),
}))

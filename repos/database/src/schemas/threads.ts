import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { agents } from '@TDB/schemas/agents'
import { ThreadIdPrefix } from '@tdsk/domain'
import { base } from '@TDB/utils/schema/base'
import { messages } from '@TDB/schemas/messages'
import { projects } from '@TDB/schemas/projects'
import { providers } from '@TDB/schemas/providers'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { entityId } from '@TDB/utils/schema/entityId'
import {
  uuid,
  text,
  jsonb,
  index,
  pgTable,
  varchar,
  boolean,
  customType,
} from 'drizzle-orm/pg-core'

const byteaType = customType<{
  data: Buffer
  notNull: false
  default: false
}>({
  dataType() {
    return `bytea`
  },
})

export const threads = pgTable(
  `threads`,
  {
    ...base,
    id: entityId(ThreadIdPrefix),
    name: text(`name`),
    meta: jsonb(`meta`),
    public: boolean(`public`).default(false),
    parentThreadId: varchar(`parent_thread_id`, { length: 10 }),
    branchMessageId: varchar(`branch_message_id`, { length: 10 }),
    providerId: varchar(`provider_id`, { length: 10 }).references(() => providers.id, {
      onDelete: `set null`,
    }),
    agentId: varchar(`agent_id`, { length: 10 }).references(() => agents.id, {
      onDelete: `set null`,
    }),
    orgId: varchar(`org_id`, { length: 10 }).references(() => orgs.id, {
      onDelete: `cascade`,
    }),
    projectId: varchar(`project_id`, { length: 10 }).references(() => projects.id, {
      onDelete: `cascade`,
    }),
    userId: uuid(`user_id`)
      .references(() => users.id, { onDelete: `cascade` })
      .notNull(),
    sandboxId: varchar(`sandbox_id`, { length: 10 }).references(() => sandboxes.id, {
      onDelete: `set null`,
    }),
    ptyBuffer: byteaType(`pty_buffer`),
  },
  (table) => [
    index(`threads_user_id_idx`).on(table.userId),
    index(`threads_agent_id_idx`).on(table.agentId),
    index(`threads_parent_thread_id_idx`).on(table.parentThreadId),
    index(`threads_org_id_idx`).on(table.orgId),
    index(`threads_project_id_idx`).on(table.projectId),
    index(`threads_sandbox_id_idx`).on(table.sandboxId),
  ]
)

export const threadsRelations = relations(threads, ({ one, many }) => ({
  messages: many(messages),
  org: one(orgs, { fields: [threads.orgId], references: [orgs.id] }),
  user: one(users, { fields: [threads.userId], references: [users.id] }),
  agent: one(agents, { fields: [threads.agentId], references: [agents.id] }),
  project: one(projects, { fields: [threads.projectId], references: [projects.id] }),
  provider: one(providers, { fields: [threads.providerId], references: [providers.id] }),
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
  sandbox: one(sandboxes, { fields: [threads.sandboxId], references: [sandboxes.id] }),
}))

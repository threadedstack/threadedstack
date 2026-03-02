import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { base } from '@TDB/utils/schema/base'
import { agents } from '@TDB/schemas/agents'
import { threads } from '@TDB/schemas/threads'
import {
  text,
  boolean,
  integer,
  varchar,
  index,
  pgTable,
  timestamp,
} from 'drizzle-orm/pg-core'

export const schedules = pgTable(
  `schedules`,
  {
    ...base,
    agentId: varchar(`agent_id`, { length: 10 })
      .references(() => agents.id, { onDelete: `cascade` })
      .notNull(),
    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),
    cronExpression: varchar(`cron_expression`, { length: 255 }).notNull(),
    prompt: text(`prompt`).notNull(),
    enabled: boolean(`enabled`).default(true).notNull(),
    lastRunAt: timestamp(`last_run_at`),
    nextRunAt: timestamp(`next_run_at`),
    threadId: varchar(`thread_id`, { length: 10 }).references(() => threads.id, {
      onDelete: `set null`,
    }),
    createThread: boolean(`create_thread`).default(true).notNull(),
    maxConsecutiveErrors: integer(`max_consecutive_errors`).default(5).notNull(),
    consecutiveErrors: integer(`consecutive_errors`).default(0).notNull(),
  },
  (table) => [
    index(`schedules_org_id_idx`).on(table.orgId),
    index(`schedules_agent_id_idx`).on(table.agentId),
    index(`schedules_enabled_next_run_idx`).on(table.enabled, table.nextRunAt),
  ]
)

export const schedulesRelations = relations(schedules, ({ one }) => ({
  agent: one(agents, {
    fields: [schedules.agentId],
    references: [agents.id],
  }),
  org: one(orgs, {
    fields: [schedules.orgId],
    references: [orgs.id],
  }),
  thread: one(threads, {
    fields: [schedules.threadId],
    references: [threads.id],
  }),
}))

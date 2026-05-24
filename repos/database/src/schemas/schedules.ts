import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { base } from '@TDB/utils/schema/base'
import { threads } from '@TDB/schemas/threads'
import { ScheduleIdPrefix } from '@tdsk/domain'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { entityId } from '@TDB/utils/schema/entityId'
import {
  text,
  uuid,
  index,
  boolean,
  integer,
  varchar,
  pgTable,
  timestamp,
} from 'drizzle-orm/pg-core'

export const schedules = pgTable(
  `schedules`,
  {
    ...base,
    id: entityId(ScheduleIdPrefix),
    prompt: text(`prompt`),
    command: text(`command`),
    lastRunAt: timestamp(`last_run_at`),
    nextRunAt: timestamp(`next_run_at`),
    enabled: boolean(`enabled`).default(true).notNull(),
    createThread: boolean(`create_thread`).default(true).notNull(),
    type: varchar(`type`, { length: 20 }).default(`prompt`).notNull(),
    consecutiveErrors: integer(`consecutive_errors`).default(0).notNull(),
    cronExpression: varchar(`cron_expression`, { length: 255 }).notNull(),
    userId: uuid(`user_id`).references(() => users.id, { onDelete: `set null` }),
    maxConsecutiveErrors: integer(`max_consecutive_errors`).default(5).notNull(),
    sandboxId: varchar(`sandbox_id`, { length: 10 })
      .references(() => sandboxes.id, { onDelete: `cascade` })
      .notNull(),
    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),
    threadId: varchar(`thread_id`, { length: 10 }).references(() => threads.id, {
      onDelete: `set null`,
    }),
  },
  (table) => [
    index(`schedules_org_id_idx`).on(table.orgId),
    index(`schedules_sandbox_id_idx`).on(table.sandboxId),
    index(`schedules_enabled_next_run_idx`).on(table.enabled, table.nextRunAt),
  ]
)

export const schedulesRelations = relations(schedules, ({ one }) => ({
  sandbox: one(sandboxes, {
    fields: [schedules.sandboxId],
    references: [sandboxes.id],
  }),
  org: one(orgs, {
    fields: [schedules.orgId],
    references: [orgs.id],
  }),
  user: one(users, {
    fields: [schedules.userId],
    references: [users.id],
  }),
  thread: one(threads, {
    fields: [schedules.threadId],
    references: [threads.id],
  }),
}))

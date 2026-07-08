import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { agents } from '@TDB/schemas/agents'
import { threads } from '@TDB/schemas/threads'
import type { TActionsConfig, TContextSource } from '@tdsk/domain'

import { base } from '@TDB/utils/schema/base'
import { ScheduleIdPrefix } from '@tdsk/domain'
import { projects } from '@TDB/schemas/projects'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { entityId } from '@TDB/utils/schema/entityId'
import {
  text,
  uuid,
  jsonb,
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
    type: varchar(`type`, { length: 20 }).default(`prompt`).notNull(),
    consecutiveErrors: integer(`consecutive_errors`).default(0).notNull(),
    cronExpression: varchar(`cron_expression`, { length: 255 }).notNull(),
    userId: uuid(`user_id`).references(() => users.id, { onDelete: `set null` }),
    agentId: varchar(`agent_id`, { length: 10 }).references(() => agents.id, {
      onDelete: `set null`,
    }),
    threadId: varchar(`thread_id`, { length: 10 }).references(() => threads.id, {
      onDelete: `set null`,
    }),
    maxConsecutiveErrors: integer(`max_consecutive_errors`).default(5).notNull(),
    timeoutMs: integer(`timeout_ms`),
    // Declarative context sources: the executor runs each `{collection, query,
    // as, max?}` via record.query (scoped to this schedule's project) and injects
    // the results under a `## <as>` heading. Nullable + additive — a schedule
    // without contextSources runs no extra query and is byte-unchanged.
    contextSources: jsonb(`context_sources`).$type<TContextSource[]>(),
    // Opt-in effect-surface allowlist (generalization ②). The executor dispatches
    // a ```tdsk-actions``` block only when this lists ≥1 Function name. Nullable +
    // additive — a schedule without `actions` is byte-unchanged and inert.
    actions: jsonb(`actions`).$type<TActionsConfig>(),
    sandboxId: varchar(`sandbox_id`, { length: 10 })
      .references(() => sandboxes.id, { onDelete: `cascade` })
      .notNull(),
    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),
    projectId: varchar(`project_id`, { length: 10 })
      .references(() => projects.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    index(`schedules_org_id_idx`).on(table.orgId),
    index(`schedules_sandbox_id_idx`).on(table.sandboxId),
    index(`schedules_project_id_idx`).on(table.projectId),
    index(`schedules_enabled_next_run_idx`).on(table.enabled, table.nextRunAt),
    index(`schedules_agent_id_idx`).on(table.agentId),
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
  project: one(projects, {
    fields: [schedules.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [schedules.userId],
    references: [users.id],
  }),
  agent: one(agents, {
    fields: [schedules.agentId],
    references: [agents.id],
  }),
  thread: one(threads, {
    fields: [schedules.threadId],
    references: [threads.id],
  }),
}))

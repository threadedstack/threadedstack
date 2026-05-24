import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { base } from '@TDB/utils/schema/base'
import { projects } from '@TDB/schemas/projects'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { SandboxSessionIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { uuid, varchar, integer, timestamp, index, pgTable } from 'drizzle-orm/pg-core'

export const sandboxSessions = pgTable(
  `sandbox_sessions`,
  {
    ...base,
    id: entityId(SandboxSessionIdPrefix),
    durationMs: integer(`duration_ms`),
    stdoutKey: varchar(`stdout_key`, { length: 255 }),
    stderrKey: varchar(`stderr_key`, { length: 255 }),
    status: varchar(`status`, { length: 20 }).notNull(),
    sessionId: varchar(`session_id`, { length: 20 }).notNull(),
    instanceId: varchar(`instance_id`, { length: 100 }).notNull(),
    completedAt: timestamp(`completed_at`, { withTimezone: true }),
    startedAt: timestamp(`started_at`, { withTimezone: true }).notNull(),
    sandboxId: varchar(`sandbox_id`, { length: 10 })
      .references(() => sandboxes.id, { onDelete: `cascade` })
      .notNull(),
    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),
    userId: uuid(`user_id`)
      .references(() => users.id, { onDelete: `cascade` })
      .notNull(),
    projectId: varchar(`project_id`, { length: 10 }).references(() => projects.id, {
      onDelete: `set null`,
    }),
  },
  (table) => [
    index(`sandbox_sessions_sandbox_id_idx`).on(table.sandboxId),
    index(`sandbox_sessions_org_id_idx`).on(table.orgId),
    index(`sandbox_sessions_sandbox_started_idx`).on(table.sandboxId, table.startedAt),
  ]
)

export const sandboxSessionsRelations = relations(sandboxSessions, ({ one }) => ({
  sandbox: one(sandboxes, {
    references: [sandboxes.id],
    fields: [sandboxSessions.sandboxId],
  }),
  org: one(orgs, {
    references: [orgs.id],
    fields: [sandboxSessions.orgId],
  }),
  user: one(users, {
    references: [users.id],
    fields: [sandboxSessions.userId],
  }),
  project: one(projects, {
    references: [projects.id],
    fields: [sandboxSessions.projectId],
  }),
}))

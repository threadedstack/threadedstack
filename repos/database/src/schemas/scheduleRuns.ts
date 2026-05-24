import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { base } from '@TDB/utils/schema/base'
import { projects } from '@TDB/schemas/projects'
import { ScheduleRunIdPrefix } from '@tdsk/domain'
import { schedules } from '@TDB/schemas/schedules'
import { entityId } from '@TDB/utils/schema/entityId'
import { text, varchar, integer, timestamp, index, pgTable } from 'drizzle-orm/pg-core'

export const scheduleRuns = pgTable(
  `schedule_runs`,
  {
    ...base,
    id: entityId(ScheduleRunIdPrefix),
    error: text(`error`),
    durationMs: integer(`duration_ms`),
    stdoutKey: varchar(`stdout_key`, { length: 255 }),
    stderrKey: varchar(`stderr_key`, { length: 255 }),
    status: varchar(`status`, { length: 20 }).notNull(),
    instanceId: varchar(`instance_id`, { length: 100 }),
    completedAt: timestamp(`completed_at`, { withTimezone: true }),
    startedAt: timestamp(`started_at`, { withTimezone: true }).notNull(),
    scheduleId: varchar(`schedule_id`, { length: 10 })
      .references(() => schedules.id, { onDelete: `cascade` })
      .notNull(),
    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),
    projectId: varchar(`project_id`, { length: 10 })
      .references(() => projects.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    index(`schedule_runs_org_id_idx`).on(table.orgId),
    index(`schedule_runs_project_id_idx`).on(table.projectId),
    index(`schedule_runs_schedule_id_idx`).on(table.scheduleId),
    index(`schedule_runs_schedule_started_idx`).on(table.scheduleId, table.startedAt),
  ]
)

export const scheduleRunsRelations = relations(scheduleRuns, ({ one }) => ({
  org: one(orgs, {
    references: [orgs.id],
    fields: [scheduleRuns.orgId],
  }),
  project: one(projects, {
    references: [projects.id],
    fields: [scheduleRuns.projectId],
  }),
  schedule: one(schedules, {
    references: [schedules.id],
    fields: [scheduleRuns.scheduleId],
  }),
}))

import type { TKubeSandboxConfig } from '@tdsk/domain'

import { relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { projects } from '@TDB/schemas/projects'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { SandboxProjectIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { text, jsonb, boolean, pgTable, unique, varchar } from 'drizzle-orm/pg-core'

/**
 * Sandbox-Projects junction table
 * Enables many-to-many relationship between sandboxes and projects
 * One sandbox can be associated with multiple projects
 * One project can have multiple sandboxes
 *
 * Also stores per-project override configuration for the sandbox.
 * NULL config = inherit base sandbox config entirely.
 * Non-null config is deep-merged with base config (project wins).
 */
export const sandboxProjects = pgTable(
  `sandbox_projects`,
  {
    ...base,
    id: entityId(SandboxProjectIdPrefix),
    sandboxId: varchar(`sandbox_id`, { length: 10 })
      .references(() => sandboxes.id, { onDelete: `cascade` })
      .notNull(),
    projectId: varchar(`project_id`, { length: 10 })
      .references(() => projects.id, { onDelete: `cascade` })
      .notNull(),
    alias: text(`alias`).notNull(),
    enabled: boolean(`enabled`).default(true),
    config: jsonb(`config`).$type<Partial<TKubeSandboxConfig> | null>(),
  },
  (table) => [
    unique(`unique_sandbox_project`).on(table.sandboxId, table.projectId),
    unique(`unique_project_alias`).on(table.projectId, table.alias),
  ]
)

export const sandboxProjectsRelations = relations(sandboxProjects, ({ one }) => ({
  sandbox: one(sandboxes, {
    fields: [sandboxProjects.sandboxId],
    references: [sandboxes.id],
  }),
  project: one(projects, {
    fields: [sandboxProjects.projectId],
    references: [projects.id],
  }),
}))

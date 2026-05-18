import { relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { projects } from '@TDB/schemas/projects'
import { providers } from '@TDB/schemas/providers'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { entityId } from '@TDB/utils/schema/entityId'
import { SandboxProjectProviderIdPrefix } from '@tdsk/domain'
import { text, index, pgTable, integer, varchar, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Sandbox-Project-Providers junction table
 * Links git providers to a sandbox for a specific project context.
 * When a sandbox runs for a project, only the git providers in this table are cloned.
 * The branch field allows per-sandbox override of the provider's default branch.
 */
export const sandboxProjectProviders = pgTable(
  `sandbox_project_providers`,
  {
    ...base,
    id: entityId(SandboxProjectProviderIdPrefix),
    sandboxId: varchar(`sandbox_id`, { length: 10 })
      .references(() => sandboxes.id, { onDelete: `cascade` })
      .notNull(),

    projectId: varchar(`project_id`, { length: 10 })
      .references(() => projects.id, { onDelete: `cascade` })
      .notNull(),

    providerId: varchar(`provider_id`, { length: 10 })
      .references(() => providers.id, { onDelete: `restrict` })
      .notNull(),

    priority: integer(`priority`).default(0),

    branch: text(`branch`),
  },
  (table) => [
    uniqueIndex(`unique_sandbox_project_provider`).on(
      table.sandboxId,
      table.projectId,
      table.providerId
    ),
    index(`idx_sandbox_project_provider_lookup`).on(table.sandboxId, table.projectId),
    index(`idx_sandbox_project_provider_provider`).on(table.providerId),
  ]
)

export const sandboxProjectProvidersRelations = relations(
  sandboxProjectProviders,
  ({ one }) => ({
    sandbox: one(sandboxes, {
      references: [sandboxes.id],
      fields: [sandboxProjectProviders.sandboxId],
    }),
    project: one(projects, {
      references: [projects.id],
      fields: [sandboxProjectProviders.projectId],
    }),
    provider: one(providers, {
      references: [providers.id],
      fields: [sandboxProjectProviders.providerId],
    }),
  })
)

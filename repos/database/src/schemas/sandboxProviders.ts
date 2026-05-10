import { sql, relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { projects } from '@TDB/schemas/projects'
import { providers } from '@TDB/schemas/providers'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { text, index, pgTable, integer, varchar, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Sandbox-Providers junction table
 * Enables many-to-many relationship between sandboxes and providers
 * One sandbox can have multiple providers (primary AI auth, future git auth)
 * One provider can be used by multiple sandboxes
 * Priority field determines the primary provider (0 = primary)
 */
export const sandboxProviders = pgTable(
  `sandbox_providers`,
  {
    ...base,
    /** Sandbox reference */
    sandboxId: varchar(`sandbox_id`, { length: 10 })
      .references(() => sandboxes.id, { onDelete: `cascade` })
      .notNull(),

    /** Provider reference */
    providerId: varchar(`provider_id`, { length: 10 })
      .references(() => providers.id, { onDelete: `restrict` })
      .notNull(),

    /** Per-provider model override: NULL = use provider default */
    model: text(`model`),

    /** Priority order: 0 = primary/default provider, 1+ = secondary */
    priority: integer(`priority`).default(0),

    /** Project scope: NULL = applies globally, set = applies only in this project context */
    projectId: varchar(`project_id`, { length: 10 }).references(() => projects.id, {
      onDelete: `cascade`,
    }),
  },
  (table) => [
    uniqueIndex(`unique_sandbox_provider_global`)
      .on(table.sandboxId, table.providerId)
      .where(sql`${table.projectId} IS NULL`),
    uniqueIndex(`unique_sandbox_provider_project`)
      .on(table.sandboxId, table.providerId, table.projectId)
      .where(sql`${table.projectId} IS NOT NULL`),
    index(`idx_sandbox_provider_sandbox`).on(table.sandboxId),
    index(`idx_sandbox_provider_priority`).on(table.sandboxId, table.priority),
  ]
)

export const sandboxProvidersRelations = relations(sandboxProviders, ({ one }) => ({
  sandbox: one(sandboxes, {
    references: [sandboxes.id],
    fields: [sandboxProviders.sandboxId],
  }),
  provider: one(providers, {
    references: [providers.id],
    fields: [sandboxProviders.providerId],
  }),
  project: one(projects, {
    references: [projects.id],
    fields: [sandboxProviders.projectId],
  }),
}))

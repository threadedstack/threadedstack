import { relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { providers } from '@TDB/schemas/providers'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { entityId } from '@TDB/utils/schema/entityId'
import { SandboxProviderIdPrefix } from '@tdsk/domain'
import { text, index, pgTable, integer, varchar, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Sandbox-Providers junction table
 * Links AI and Docker providers to sandboxes (global, not project-scoped).
 * Git providers use the separate sandbox_project_providers table.
 */
export const sandboxProviders = pgTable(
  `sandbox_providers`,
  {
    ...base,
    id: entityId(SandboxProviderIdPrefix),
    sandboxId: varchar(`sandbox_id`, { length: 10 })
      .references(() => sandboxes.id, { onDelete: `cascade` })
      .notNull(),

    providerId: varchar(`provider_id`, { length: 10 })
      .references(() => providers.id, { onDelete: `restrict` })
      .notNull(),

    model: text(`model`),

    priority: integer(`priority`).default(0),
  },
  (table) => [
    index(`idx_sandbox_provider_sandbox`).on(table.sandboxId),
    index(`idx_sandbox_provider_priority`).on(table.sandboxId, table.priority),
    uniqueIndex(`unique_sandbox_provider`).on(table.sandboxId, table.providerId),
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
}))

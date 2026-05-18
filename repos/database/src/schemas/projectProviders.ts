import { relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { projects } from '@TDB/schemas/projects'
import { providers } from '@TDB/schemas/providers'
import { ProjectProviderIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { pgTable, unique, integer, index, varchar } from 'drizzle-orm/pg-core'

export const projectProviders = pgTable(
  `project_providers`,
  {
    ...base,
    id: entityId(ProjectProviderIdPrefix),
    projectId: varchar(`project_id`, { length: 10 })
      .references(() => projects.id, { onDelete: `cascade` })
      .notNull(),

    providerId: varchar(`provider_id`, { length: 10 })
      .references(() => providers.id, { onDelete: `restrict` })
      .notNull(),

    priority: integer(`priority`).default(0),
  },
  (table) => [
    unique(`unique_project_provider`).on(table.projectId, table.providerId),
    index(`idx_project_provider_project`).on(table.projectId),
  ]
)

export const projectProvidersRelations = relations(projectProviders, ({ one }) => ({
  project: one(projects, {
    references: [projects.id],
    fields: [projectProviders.projectId],
  }),
  provider: one(providers, {
    references: [providers.id],
    fields: [projectProviders.providerId],
  }),
}))

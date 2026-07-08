import type { TFunctionParam } from '@tdsk/domain'

import { relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { projects } from '@TDB/schemas/projects'
import { endpoints } from '@TDB/schemas/endpoints'
import { entityId } from '@TDB/utils/schema/entityId'
import { EFunLanguage, FunctionIdPrefix } from '@tdsk/domain'
import { text, jsonb, varchar, index, pgTable } from 'drizzle-orm/pg-core'

export const functions = pgTable(
  `functions`,
  {
    ...base,
    id: entityId(FunctionIdPrefix),
    name: text(`name`).notNull(),
    description: text(`description`),
    content: text(`content`).notNull(),
    branch: text(`branch`).default(`main`),
    defaultArgs: jsonb(`default_args`).default({}),
    dependencies: jsonb(`dependencies`).default({}),
    inputSchema: jsonb(`input_schema`).default([]).$type<TFunctionParam[]>(),
    // Provenance/annotation metadata — e.g. { authoredBy, version } stamped by
    // the authorFunction self-extension surface (resident agents R3).
    meta: jsonb(`meta`).$type<Record<string, any>>(),
    language: varchar(`language`, { length: 50 }).default(EFunLanguage.typescript),
    endpointId: varchar(`endpoint_id`, { length: 10 }).references(() => endpoints.id, {
      onDelete: `cascade`,
    }),
    projectId: varchar(`project_id`, { length: 10 })
      .references(() => projects.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    index(`functions_project_id_idx`).on(table.projectId),
    index(`functions_endpoint_id_idx`).on(table.endpointId),
  ]
)

export const functionsRelations = relations(functions, ({ one }) => ({
  endpoint: one(endpoints, {
    fields: [functions.endpointId],
    references: [endpoints.id],
  }),
  project: one(projects, {
    fields: [functions.projectId],
    references: [projects.id],
  }),
}))

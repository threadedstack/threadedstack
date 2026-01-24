import { relations } from 'drizzle-orm'
import { EFunLanguage } from '@tdsk/domain'
import { base } from '@TDB/utils/schema/base'
import { projects } from '@TDB/schemas/projects'
import { endpoints } from '@TDB/schemas/endpoints'
import { uuid, text, jsonb, varchar, pgTable } from 'drizzle-orm/pg-core'

export const functions = pgTable(`functions`, {
  ...base,
  name: text(`name`).notNull(),
  description: text(`description`),
  content: text(`content`).notNull(),
  branch: text(`branch`).default(`main`),
  defaultArgs: jsonb(`default_args`).default([]),
  dependencies: jsonb(`dependencies`).default({}),
  language: varchar(`language`, { length: 50 }).default(EFunLanguage.typescript),
  endpointId: uuid(`endpoint_id`).references(() => endpoints.id, { onDelete: `cascade` }),
  projectId: uuid(`project_id`)
    .references(() => projects.id, { onDelete: `cascade` })
    .notNull(),
})

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

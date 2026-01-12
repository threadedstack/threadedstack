import { relations } from 'drizzle-orm'
import { projects } from '@TDB/schemas/projects'
import { base } from '@TDB/utils/schema/base'
import { endpoints } from '@TDB/schemas/endpoints'
import { uuid, text, jsonb, varchar, pgTable } from 'drizzle-orm/pg-core'

export const functions = pgTable(`functions`, {
  ...base,
  name: text(`name`).notNull(),
  description: text(`name`),
  defaultArgs: jsonb(`default_args`),
  content: text(`content`).notNull(),
  dependencies: jsonb(`dependencies`),
  language: varchar(`language`, { length: 50 }).default(`typescript`),
  endpointId: uuid(`endpoint_id`)
    .references(() => endpoints.id, { onDelete: `cascade` })
    .notNull(),
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

import { relations } from 'drizzle-orm'
import { projects } from '@TDB/schemas/projects'
import { base } from '@TDB/utils/schema/base'
import { functions } from '@TDB/schemas/functions'
import { uuid, text, jsonb, varchar, boolean, pgTable } from 'drizzle-orm/pg-core'

export const endpoints = pgTable(`endpoints`, {
  ...base,
  url: text(`url`),
  name: text(`name`),
  path: text(`name`),
  headers: jsonb(`headers`),
  options: jsonb(`options`),
  public: boolean(`public`).default(false),
  method: varchar(`method`, { length: 10 }).default(`GET`),
  projectId: uuid(`project_id`)
    .references(() => projects.id, { onDelete: `cascade` })
    .notNull(),
})

export const endpointsRelations = relations(endpoints, ({ one, many }) => ({
  functions: many(functions),
  project: one(projects, {
    references: [projects.id],
    fields: [endpoints.projectId],
  }),
}))

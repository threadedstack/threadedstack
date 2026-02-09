import { relations } from 'drizzle-orm'
import { projects } from '@TDB/schemas/projects'
import { base } from '@TDB/utils/schema/base'
import { functions } from '@TDB/schemas/functions'
import {
  uuid,
  text,
  jsonb,
  varchar,
  boolean,
  uniqueIndex,
  pgTable,
} from 'drizzle-orm/pg-core'

export const endpoints = pgTable(
  `endpoints`,
  {
    ...base,
    name: text(`name`),
    headers: jsonb(`headers`),
    options: jsonb(`options`),
    path: text(`path`).notNull(),
    public: boolean(`public`).default(false),
    method: varchar(`method`, { length: 10 }).default(`GET`),
    type: varchar(`type`, { length: 10 }).notNull().default(`proxy`),
    projectId: uuid(`project_id`)
      .references(() => projects.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    uniqueIndex(`endpoints_project_path_method_idx`).on(
      table.projectId,
      table.path,
      table.method
    ),
  ]
)

export const endpointsRelations = relations(endpoints, ({ one, many }) => ({
  functions: many(functions),
  project: one(projects, {
    references: [projects.id],
    fields: [endpoints.projectId],
  }),
}))

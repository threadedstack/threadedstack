import { relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { EndpointIdPrefix } from '@tdsk/domain'
import { projects } from '@TDB/schemas/projects'
import { functions } from '@TDB/schemas/functions'
import { entityId } from '@TDB/utils/schema/entityId'
import { text, jsonb, varchar, boolean, uniqueIndex, pgTable } from 'drizzle-orm/pg-core'

export const endpoints = pgTable(
  `endpoints`,
  {
    ...base,
    id: entityId(EndpointIdPrefix),
    name: text(`name`),
    headers: jsonb(`headers`),
    options: jsonb(`options`),
    // Provenance/annotation metadata — e.g. { authoredBy, version } stamped by
    // the authorEndpoint self-extension surface (resident agents author their
    // own proxy Endpoints; mirrors functions.meta).
    meta: jsonb(`meta`).$type<Record<string, any>>(),
    path: text(`path`).notNull(),
    public: boolean(`public`).default(false),
    method: varchar(`method`, { length: 10 }).default(`GET`),
    type: varchar(`type`, { length: 10 }).notNull().default(`proxy`),
    projectId: varchar(`project_id`, { length: 10 })
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

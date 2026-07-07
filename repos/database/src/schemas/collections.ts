import type { TCollectionSchema } from '@tdsk/domain'

import { relations } from 'drizzle-orm'
import { records } from '@TDB/schemas/records'
import { projects } from '@TDB/schemas/projects'
import { base } from '@TDB/utils/schema/base'
import { CollectionIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { text, jsonb, index, pgTable, varchar, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Collections table
 * A project-scoped, optionally-schema'd set of Records (structured jsonb
 * documents). Consumer-defined — agents/Functions reference a collection by
 * `name` within their project. When `schema` is present, record writes are
 * validated against it. Purely additive; nothing in the live loop uses these.
 */
export const collections = pgTable(
  `collections`,
  {
    ...base,
    id: entityId(CollectionIdPrefix),

    /** Collection name — unique within a project. */
    name: text(`name`).notNull(),

    /** Human description of the collection. */
    description: text(`description`),

    /** Optional field schema. When present, record writes are validated. */
    schema: jsonb(`schema`).$type<TCollectionSchema>(),

    projectId: varchar(`project_id`, { length: 10 })
      .references(() => projects.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    index(`collections_project_id_idx`).on(table.projectId),
    uniqueIndex(`collections_project_id_name_idx`).on(table.projectId, table.name),
  ]
)

export const collectionsRelations = relations(collections, ({ one, many }) => ({
  project: one(projects, {
    fields: [collections.projectId],
    references: [projects.id],
  }),
  records: many(records),
}))

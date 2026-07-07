import { relations } from 'drizzle-orm'
import { projects } from '@TDB/schemas/projects'
import { base } from '@TDB/utils/schema/base'
import { RecordIdPrefix } from '@tdsk/domain'
import { collections } from '@TDB/schemas/collections'
import { entityId } from '@TDB/utils/schema/entityId'
import { jsonb, index, pgTable, varchar } from 'drizzle-orm/pg-core'

/**
 * Records table
 * A JSON document (`data`) belonging to a Collection, scoped to a project.
 * `projectId` is denormalized from the collection for fast project-wide scoping
 * guards. A GIN index on `data` supports containment/field queries. Purely
 * additive; nothing in the live loop reads or writes these.
 */
export const records = pgTable(
  `records`,
  {
    ...base,
    id: entityId(RecordIdPrefix),

    /** The JSON document. */
    data: jsonb(`data`).notNull().$type<Record<string, any>>(),

    collectionId: varchar(`collection_id`, { length: 10 })
      .references(() => collections.id, { onDelete: `cascade` })
      .notNull(),

    projectId: varchar(`project_id`, { length: 10 })
      .references(() => projects.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    index(`records_collection_id_idx`).on(table.collectionId),
    index(`records_project_id_idx`).on(table.projectId),
    index(`records_data_idx`).using(`gin`, table.data),
  ]
)

export const recordsRelations = relations(records, ({ one }) => ({
  collection: one(collections, {
    fields: [records.collectionId],
    references: [collections.id],
  }),
  project: one(projects, {
    fields: [records.projectId],
    references: [projects.id],
  }),
}))

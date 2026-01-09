import { relations } from 'drizzle-orm'
import { repos } from '@TDB/schemas/repos'
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
  repoId: uuid(`repo_id`)
    .references(() => repos.id, { onDelete: `cascade` })
    .notNull(),
})

export const functionsRelations = relations(functions, ({ one }) => ({
  endpoint: one(endpoints, {
    fields: [functions.endpointId],
    references: [endpoints.id],
  }),
  repo: one(repos, {
    fields: [functions.repoId],
    references: [repos.id],
  }),
}))

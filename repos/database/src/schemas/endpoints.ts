import { relations } from 'drizzle-orm'
import { repos } from '@TDB/schemas/repos'
import { base } from '@TDB/utils/schema/base'
import { functions } from '@TDB/schemas/functions'
import { uuid, text, jsonb, varchar, boolean, pgTable } from 'drizzle-orm/pg-core'

export const endpoints = pgTable(`endpoints`, {
  ...base,
  url: text(`url`),
  name: text(`name`),
  headers: jsonb(`headers`),
  options: jsonb(`options`),
  public: boolean(`public`).default(false),
  method: varchar(`method`, { length: 10 }).default(`GET`),
  repoId: uuid(`repo_id`)
    .references(() => repos.id, { onDelete: `cascade` })
    .notNull(),
})

export const endpointsRelations = relations(endpoints, ({ one, many }) => ({
  functions: many(functions),
  repo: one(repos, {
    references: [repos.id],
    fields: [endpoints.repoId],
  }),
}))

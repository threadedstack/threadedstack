
import { relations } from 'drizzle-orm'
import { repos } from '@TDB/schemas/repos'
import { base } from '@TDB/utils/schema/base'
import { functions } from '@TDB/schemas/functions'
import {
  uuid,
  text,
  jsonb,
  varchar,
  boolean,
  pgTable,
} from 'drizzle-orm/pg-core'

export const endpoints = pgTable(`endpoints`, {
  ...base,
  proxyUrl: text(`proxy_url`),
  proxyHeaders: jsonb(`proxy_headers`),
  proxyOptions: jsonb(`proxy_options`),
  public: boolean(`public`).default(false),
  proxyMethod: varchar(`proxy_method`, { length: 10 }).default(`GET`),
  repoId: uuid(`repo_id`).references(() => repos.id, { onDelete: `cascade` }).notNull(),
})


export const endpointsRelations = relations(endpoints, ({ one, many }) => ({
  functions: many(functions),
  repo: one(repos, {
    references: [repos.id],
    fields: [endpoints.repoId],
  }),
}))
import { relations } from 'drizzle-orm'
import { providers } from '@TDB/schemas/providers'
import { endpoints } from '@TDB/schemas/endpoints'
import { base } from '@TDB/utils/schema/base'
import {
  uuid,
  text,
  jsonb,
  varchar,
  pgTable,
} from 'drizzle-orm/pg-core'


export const functions = pgTable(`functions`, {
  ...base,
  defaultArgs: jsonb(`default_args`),
  content: text(`content`).notNull(),
  dependencies: jsonb(`dependencies`),
  language: varchar(`language`, { length: 50 }).default(`typescript`),
  providerId: uuid(`provider_id`).references(() => providers.id).notNull(),
  endpointId: uuid(`endpoint_id`).references(() => endpoints.id, { onDelete: `cascade` }).notNull(),
})


export const functionsRelations = relations(functions, ({ one }) => ({
  endpoint: one(endpoints, { fields: [functions.endpointId], references: [endpoints.id] }),
  provider: one(providers, { fields: [functions.providerId], references: [providers.id] }),
}))

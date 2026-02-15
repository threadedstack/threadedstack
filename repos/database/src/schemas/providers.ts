import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { base } from '@TDB/utils/schema/base'
import { uuid, jsonb, pgTable, text } from 'drizzle-orm/pg-core'

export const providers = pgTable(`providers`, {
  ...base,
  name: text(`name`),
  options: jsonb(`options`),
  headers: jsonb(`headers`),
  type: text(`type`).notNull(),
  orgId: uuid(`org_id`)
    .notNull()
    .references(() => orgs.id, { onDelete: `cascade` }),
})

export const providersRelations = relations(providers, ({ one }) => ({
  org: one(orgs, { fields: [providers.orgId], references: [orgs.id] }),
}))

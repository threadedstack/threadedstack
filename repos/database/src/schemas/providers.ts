import type { EProvider } from '@tdsk/domain'

import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { base } from '@TDB/utils/schema/base'
import { agentProviders } from '@TDB/schemas/agentProviders'
import { uuid, jsonb, pgTable, text } from 'drizzle-orm/pg-core'

export const providers = pgTable(`providers`, {
  ...base,
  name: text(`name`),
  type: text(`type`).notNull().$type<EProvider>(),
  options: jsonb(`options`).$type<Record<string, any>>(),
  headers: jsonb(`headers`).$type<Record<string, string>>(),
  bodyParams: jsonb(`body_params`).$type<Record<string, any>>(),
  orgId: uuid(`org_id`)
    .notNull()
    .references(() => orgs.id, { onDelete: `cascade` }),
})

export const providersRelations = relations(providers, ({ one, many }) => ({
  org: one(orgs, { fields: [providers.orgId], references: [orgs.id] }),
  agents: many(agentProviders),
}))

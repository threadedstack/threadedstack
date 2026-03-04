import type { EProvider, TProviderBrand } from '@tdsk/domain'

import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { base } from '@TDB/utils/schema/base'
import { agentProviders } from '@TDB/schemas/agentProviders'
import { jsonb, index, pgTable, text, varchar } from 'drizzle-orm/pg-core'

export const providers = pgTable(
  `providers`,
  {
    ...base,
    name: text(`name`),
    type: text(`type`).notNull().$type<EProvider>(),
    brand: text(`brand`).$type<TProviderBrand>(),
    options: jsonb(`options`).$type<Record<string, any>>(),
    headers: jsonb(`headers`).$type<Record<string, string>>(),
    bodyParams: jsonb(`body_params`).$type<Record<string, any>>(),
    // FK to secrets.id — defined via migration to avoid circular import (secrets → providers → secrets)
    secretId: varchar(`secret_id`, { length: 10 }),
    orgId: varchar(`org_id`, { length: 10 })
      .notNull()
      .references(() => orgs.id, { onDelete: `cascade` }),
  },
  (table) => [index(`providers_org_id_idx`).on(table.orgId)]
)

export const providersRelations = relations(providers, ({ one, many }) => ({
  org: one(orgs, { fields: [providers.orgId], references: [orgs.id] }),
  agents: many(agentProviders),
}))

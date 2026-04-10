import type { EProvider, TProviderBrand } from '@tdsk/domain'

import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { base } from '@TDB/utils/schema/base'
import { agentProviders } from '@TDB/schemas/agentProviders'
import { sandboxProviders } from '@TDB/schemas/sandboxProviders'
import { jsonb, index, pgTable, text, varchar } from 'drizzle-orm/pg-core'

export const providers = pgTable(
  `providers`,
  {
    ...base,
    name: text(`name`),
    brand: text(`brand`).$type<TProviderBrand>(),
    type: text(`type`).notNull().$type<EProvider>(),
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
  agents: many(agentProviders),
  sandboxes: many(sandboxProviders),
  org: one(orgs, { fields: [providers.orgId], references: [orgs.id] }),
}))

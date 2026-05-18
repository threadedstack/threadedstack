import type { EProvider, TProviderBrand } from '@tdsk/domain'

import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { base } from '@TDB/utils/schema/base'
import { secrets } from '@TDB/schemas/secrets'
import { ProviderIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { agentProviders } from '@TDB/schemas/agentProviders'
import { sandboxProviders } from '@TDB/schemas/sandboxProviders'
import { projectProviders } from '@TDB/schemas/projectProviders'
import { jsonb, index, pgTable, text, varchar } from 'drizzle-orm/pg-core'
import { sandboxProjectProviders } from '@TDB/schemas/sandboxProjectProviders'

export const providers = pgTable(
  `providers`,
  {
    ...base,
    id: entityId(ProviderIdPrefix),
    name: text(`name`),
    brand: text(`brand`).$type<TProviderBrand>(),
    type: text(`type`).notNull().$type<EProvider>(),
    options: jsonb(`options`).$type<Record<string, any>>(),
    headers: jsonb(`headers`).$type<Record<string, string>>(),
    bodyParams: jsonb(`body_params`).$type<Record<string, any>>(),
    secretId: varchar(`secret_id`, { length: 10 }).references(() => secrets.id, {
      onDelete: `restrict`,
    }),
    orgId: varchar(`org_id`, { length: 10 })
      .notNull()
      .references(() => orgs.id, { onDelete: `cascade` }),
  },
  (table) => [index(`providers_org_id_idx`).on(table.orgId)]
)

export const providersRelations = relations(providers, ({ one, many }) => ({
  agents: many(agentProviders),
  projects: many(projectProviders),
  sandboxes: many(sandboxProviders),
  sandboxProjectLinks: many(sandboxProjectProviders),
  org: one(orgs, { fields: [providers.orgId], references: [orgs.id] }),
  secret: one(secrets, { fields: [providers.secretId], references: [secrets.id] }),
}))

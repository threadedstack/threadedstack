import { base } from '@TDB/utils/schema/base'
import { orgs } from '@TDB/schemas/orgs'
import { relations } from 'drizzle-orm'
import { pgTable, text, integer, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const quotas = pgTable(
  `quotas`,
  {
    ...base,
    orgId: uuid(`org_id`)
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),
    // Period Identification e.g. "2023-10" or "yearly-2023"
    period: text(`period`).notNull(),
    price: integer(`price`).default(0),
    retention: integer(`retention`).default(0),
    organizations: integer(`organizations`).default(0),
    projects: integer(`projects`).default(0),
    members: integer(`members`).default(0),
    endpoints: integer(`endpoints`).default(0),
    threads: integer(`threads`).default(0),
    messages: integer(`messages`).default(0),
    functionCalls: integer(`function_calls`).default(0),
    runtime: integer(`runtime`).default(0),
    orgSecrets: integer(`org_secrets`).default(0),
    projectSecrets: integer(`project_secrets`).default(0),
  },
  (table) => [uniqueIndex(`quotas_org_period_idx`).on(table.orgId, table.period)]
)

export const quotasRelations = relations(quotas, ({ one }) => ({
  org: one(orgs, {
    fields: [quotas.orgId],
    references: [orgs.id],
  }),
}))

import { base } from '@TDB/utils/schema/base'
import { orgs } from '@TDB/schemas/orgs'
import { relations } from 'drizzle-orm'
import { pgTable, text, integer, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

export const quotas = pgTable(
  `quotas`,
  {
    ...base,
    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),
    // Period Identification e.g. "2023-10" or "yearly-2023"
    period: text(`period`).notNull(),
    projects: integer(`projects`).default(0).notNull(),
    compute: integer(`compute`).default(0).notNull(),
    threads: integer(`threads`).default(0).notNull(),
    messages: integer(`messages`).default(0).notNull(),
    endpoints: integer(`endpoints`).default(0).notNull(),
    secrets: integer(`secrets`).default(0).notNull(),
  },
  (table) => [uniqueIndex(`quotas_org_period_idx`).on(table.orgId, table.period)]
)

export const quotasRelations = relations(quotas, ({ one }) => ({
  org: one(orgs, {
    fields: [quotas.orgId],
    references: [orgs.id],
  }),
}))

import { base } from '@TDB/utils/schema/base'
import { orgs } from '@TDB/schemas/orgs'
import { relations } from 'drizzle-orm'
import { pgTable, text, integer, bigint, uniqueIndex, uuid } from 'drizzle-orm/pg-core'

export const quotas = pgTable(
  `quotas`,
  {
    ...base,
    // Period Identification e.g. "2023-10" or "yearly-2023"
    period: text(`period`).notNull(),
    threads: integer(`threads`).default(0),
    messages: integer(`messages`).default(0),
    functionCalls: integer(`function_calls`).default(0),
    storageBytes: bigint(`storage_bytes`, { mode: `number` }).default(0),
    orgId: uuid(`org_id`)
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),
    functionDurationMs: bigint(`function_duration_ms`, { mode: `number` }).default(0),
  },
  (table) => [uniqueIndex(`quotas_org_period_idx`).on(table.orgId, table.period)]
)

export const quotasRelations = relations(quotas, ({ one }) => ({
  org: one(orgs, {
    fields: [quotas.orgId],
    references: [orgs.id],
  }),
}))

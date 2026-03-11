import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { base } from '@TDB/utils/schema/base'
import { text, jsonb, uuid, varchar, index, pgTable } from 'drizzle-orm/pg-core'

import type { TKubeSandboxConfig } from '@tdsk/domain'

export const sandboxes = pgTable(
  `sandboxes`,
  {
    ...base,
    name: text(`name`).notNull(),
    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),
    userId: uuid(`user_id`).references(() => users.id, { onDelete: `set null` }),
    config: jsonb(`config`).notNull().$type<TKubeSandboxConfig>(),
  },
  (table) => [
    index(`sandboxes_org_idx`).on(table.orgId),
    index(`sandboxes_org_user_idx`).on(table.orgId, table.userId),
  ]
)

export const sandboxesRelations = relations(sandboxes, ({ one }) => ({
  org: one(orgs, {
    references: [orgs.id],
    fields: [sandboxes.orgId],
  }),
  user: one(users, {
    references: [users.id],
    fields: [sandboxes.userId],
  }),
}))

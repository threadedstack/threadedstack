import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { repos } from '@TDB/schemas/repos'
import { users } from '@TDB/schemas/users'
import { base } from '@TDB/utils/schema/base'
import { uuid, jsonb, pgTable, text } from 'drizzle-orm/pg-core'

export const providers = pgTable(`providers`, {
  ...base,
  name: text(`name`),
  options: jsonb(`options`),
  type: text(`type`).notNull(),
  repoId: uuid(`repo_id`).references(() => repos.id, { onDelete: `cascade` }),
  orgId: uuid(`org_id`).references(() => orgs.id, { onDelete: `cascade` }),
  userId: uuid(`user_id`).references(() => users.id, { onDelete: `cascade` }),
})

export const providersRelations = relations(providers, ({ one }) => ({
  org: one(orgs, { fields: [providers.orgId], references: [orgs.id] }),
  user: one(users, { fields: [providers.userId], references: [users.id] }),
  repo: one(repos, { fields: [providers.repoId], references: [repos.id] }),
}))

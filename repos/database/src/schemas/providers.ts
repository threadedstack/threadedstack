import { relations } from 'drizzle-orm'
import { teams } from '@TDB/schemas/teams'
import { users } from '@TDB/schemas/users'
import { base } from '@TDB/utils/schema/base'
import { uuid, jsonb, pgEnum, pgTable } from 'drizzle-orm/pg-core'

export const providerTypeEnum = pgEnum(`provider_type`, [`auth`, `git`, `ai`, `storage`])

export const providers = pgTable(`providers`, {
  ...base,
  options: jsonb(`options`),
  type: providerTypeEnum(`type`).notNull(),
  teamId: uuid(`team_id`).references(() => teams.id, { onDelete: `cascade` }),
  userId: uuid(`user_id`).references(() => users.id, { onDelete: `cascade` }),
})

export const providersRelations = relations(providers, ({ one }) => ({
  team: one(teams, { fields: [providers.teamId], references: [teams.id] }),
  user: one(users, { fields: [providers.userId], references: [users.id] }),
}))

import { sql, relations } from 'drizzle-orm'
import { teams } from '@TDB/schemas/teams'
import { users } from '@TDB/schemas/users'
import { repos } from '@TDB/schemas/repos'
import { base } from '@TDB/utils/schema/base'
import {
  uuid,
  text,
  check,
  pgEnum,
  pgTable,
} from 'drizzle-orm/pg-core'

export const roleTypeEnum = pgEnum(`role_type`, [`super`, `admin`, `basic`])

export const roles = pgTable(`roles`, {
  ...base,
  name: text(`name`),
  type: roleTypeEnum(`type`).default(`basic`).notNull(),
  teamId: uuid(`team_id`).references(() => teams.id, { onDelete: `cascade` }),
  repoId: uuid(`repo_id`).references(() => repos.id, { onDelete: `cascade` }),
  userId: uuid(`user_id`).references(() => users.id, { onDelete: `cascade` }).notNull(),
}, (table) => [
  check(`role_scope_check`, sql`
    (${table.teamId} IS NOT NULL AND ${table.repoId} IS NULL) OR 
    (${table.teamId} IS NULL AND ${table.repoId} IS NOT NULL)
  `)
])


export const rolesRelations = relations(roles, ({ one }) => ({
  user: one(users, { fields: [roles.userId], references: [users.id] }),
  team: one(teams, { fields: [roles.teamId], references: [teams.id] }),
  repo: one(repos, { fields: [roles.repoId], references: [repos.id] }),
}))

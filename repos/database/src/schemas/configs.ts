import { teams } from '@TDB/schemas/teams'
import { users } from '@TDB/schemas/users'
import { repos } from '@TDB/schemas/repos'
import { base } from '@TDB/utils/schema/base'
import {
  uuid,
  text,
  jsonb,
  check,
  pgEnum,
  boolean,
  pgTable,
} from 'drizzle-orm/pg-core'
import { sql } from 'drizzle-orm'

export const configs = pgTable('configs', {
  ...base,
  data: jsonb(`data`).notNull(),
  userId: uuid(`user_id`).references(() => users.id, { onDelete: `cascade` }),
  teamId: uuid(`team_id`).references(() => teams.id, { onDelete: `cascade` }),
  repoId: uuid(`repo_id`).references(() => repos.id, { onDelete: `cascade` }),
}, (table) => [
  // CHANGE: Array syntax
  check(`config_owner_check`, sql`
    (
      (${table.userId} IS NOT NULL)::int + 
      (${table.teamId} IS NOT NULL)::int + 
      (${table.repoId} IS NOT NULL)::int
    ) = 1
  `)
])

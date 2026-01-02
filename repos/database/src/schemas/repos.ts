import { relations } from 'drizzle-orm'
import { teams } from '@TDB/schemas/teams'
import { assets } from '@TDB/schemas/assets'
import { base } from '@TDB/utils/schema/base'
import { secrets } from '@TDB/schemas/secrets'
import { configs } from '@TDB/schemas/configs'
import { endpoints } from '@TDB/schemas/endpoints'
import { providers } from '@TDB/schemas/providers'
import {
  uuid,
  text,
  jsonb,
  pgTable,
} from 'drizzle-orm/pg-core'


export const repos = pgTable(`repos`, {
  ...base,
  meta: jsonb(`meta`),
  name: text(`name`).notNull(),
  gitUrl: text(`git_url`).notNull(),
  branch: text(`branch`).default(`main`),
  teamId: uuid(`team_id`).references(() => teams.id, { onDelete: `cascade` }).notNull(),
})


export const reposRelations = relations(repos, ({ one, many }) => ({
  assets: many(assets),
  secrets: many(secrets),
  configs: many(configs),
  providers: many(providers),
  endpoints: many(endpoints),
  team: one(teams, {
    fields: [repos.teamId],
    references: [teams.id],
  }),
}))

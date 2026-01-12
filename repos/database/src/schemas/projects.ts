import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { assets } from '@TDB/schemas/assets'
import { base } from '@TDB/utils/schema/base'
import { secrets } from '@TDB/schemas/secrets'
import { configs } from '@TDB/schemas/configs'
import { endpoints } from '@TDB/schemas/endpoints'
import { providers } from '@TDB/schemas/providers'
import { uuid, text, jsonb, pgTable } from 'drizzle-orm/pg-core'

export const projects = pgTable(`projects`, {
  ...base,
  meta: jsonb(`meta`),
  gitUrl: text(`git_url`),
  name: text(`name`).notNull(),
  branch: text(`branch`).default(`main`),
  orgId: uuid(`org_id`)
    .references(() => orgs.id, { onDelete: `cascade` })
    .notNull(),
})

export const projectsRelations = relations(projects, ({ one, many }) => ({
  assets: many(assets),
  secrets: many(secrets),
  configs: many(configs),
  providers: many(providers),
  endpoints: many(endpoints),
  org: one(orgs, {
    fields: [projects.orgId],
    references: [orgs.id],
  }),
}))

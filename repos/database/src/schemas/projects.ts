import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { assets } from '@TDB/schemas/assets'
import { base } from '@TDB/utils/schema/base'
import { secrets } from '@TDB/schemas/secrets'
import { endpoints } from '@TDB/schemas/endpoints'
import { providers } from '@TDB/schemas/providers'
import { agentProjects } from '@TDB/schemas/agentProjects'
import { uuid, text, jsonb, uniqueIndex, index, pgTable } from 'drizzle-orm/pg-core'

export const projects = pgTable(
  `projects`,
  {
    ...base,
    meta: jsonb(`meta`),
    gitUrl: text(`git_url`),
    name: text(`name`).notNull(),
    description: text(`description`),
    branch: text(`branch`).default(`main`),
    orgId: uuid(`org_id`)
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    uniqueIndex(`projects_org_name_idx`).on(table.orgId, table.name),
    index(`projects_org_id_idx`).on(table.orgId),
  ]
)

export const projectsRelations = relations(projects, ({ one, many }) => ({
  assets: many(assets),
  secrets: many(secrets),
  providers: many(providers),
  endpoints: many(endpoints),
  agents: many(agentProjects),
  org: one(orgs, {
    fields: [projects.orgId],
    references: [orgs.id],
  }),
}))

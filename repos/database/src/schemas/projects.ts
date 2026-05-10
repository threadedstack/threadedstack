import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { assets } from '@TDB/schemas/assets'
import { base } from '@TDB/utils/schema/base'
import { secrets } from '@TDB/schemas/secrets'
import { endpoints } from '@TDB/schemas/endpoints'
import { agentProjects } from '@TDB/schemas/agentProjects'
import { sandboxProjects } from '@TDB/schemas/sandboxProjects'
import { projectProviders } from '@TDB/schemas/projectProviders'
import { sandboxProjectProviders } from '@TDB/schemas/sandboxProjectProviders'
import { text, jsonb, uniqueIndex, index, pgTable, varchar } from 'drizzle-orm/pg-core'

export const projects = pgTable(
  `projects`,
  {
    ...base,
    meta: jsonb(`meta`),
    name: text(`name`).notNull(),
    description: text(`description`),
    orgId: varchar(`org_id`, { length: 10 })
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
  endpoints: many(endpoints),
  agents: many(agentProjects),
  sandboxes: many(sandboxProjects),
  providerLinks: many(projectProviders),
  sandboxProviderLinks: many(sandboxProjectProviders),
  org: one(orgs, {
    fields: [projects.orgId],
    references: [orgs.id],
  }),
}))

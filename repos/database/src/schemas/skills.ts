import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { base } from '@TDB/utils/schema/base'
import { agentSkills } from '@TDB/schemas/agentSkills'
import { text, jsonb, boolean, varchar, index, pgTable } from 'drizzle-orm/pg-core'

export const skills = pgTable(
  `skills`,
  {
    ...base,
    name: text(`name`).notNull(),
    description: text(`description`).notNull(),
    instructions: text(`instructions`).notNull(),
    triggerKeywords: jsonb(`trigger_keywords`).default([]).$type<string[]>(),
    tools: jsonb(`tools`).default([]).$type<string[]>(),
    alwaysActive: boolean(`always_active`).default(false).notNull(),
    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [index(`skills_org_id_idx`).on(table.orgId)]
)

export const skillsRelations = relations(skills, ({ one, many }) => ({
  org: one(orgs, {
    fields: [skills.orgId],
    references: [orgs.id],
  }),
  agents: many(agentSkills),
}))

import { relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { agents } from '@TDB/schemas/agents'
import { skills } from '@TDB/schemas/skills'
import { pgTable, unique, varchar } from 'drizzle-orm/pg-core'

export const agentSkills = pgTable(
  `agent_skills`,
  {
    ...base,
    agentId: varchar(`agent_id`, { length: 10 })
      .references(() => agents.id, { onDelete: `cascade` })
      .notNull(),
    skillId: varchar(`skill_id`, { length: 10 })
      .references(() => skills.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [unique(`unique_agent_skill`).on(table.agentId, table.skillId)]
)

export const agentSkillsRelations = relations(agentSkills, ({ one }) => ({
  agent: one(agents, {
    fields: [agentSkills.agentId],
    references: [agents.id],
  }),
  skill: one(skills, {
    fields: [agentSkills.skillId],
    references: [skills.id],
  }),
}))

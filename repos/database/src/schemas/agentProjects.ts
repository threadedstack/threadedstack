import { relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { agents } from '@TDB/schemas/agents'
import { projects } from '@TDB/schemas/projects'
import { uuid, pgTable, unique, text } from 'drizzle-orm/pg-core'

/**
 * Agent-Projects junction table
 * Enables many-to-many relationship between agents and projects
 * One agent can be associated with multiple projects
 * One project can have multiple agents
 */
export const agentProjects = pgTable(
  `agent_projects`,
  {
    ...base,
    /** Agent reference */
    agentId: uuid(`agent_id`)
      .references(() => agents.id, { onDelete: `cascade` })
      .notNull(),

    /** Project reference */
    projectId: uuid(`project_id`)
      .references(() => projects.id, { onDelete: `cascade` })
      .notNull(),

    /** Optional display name or alias for this agent in the project context */
    alias: text(`alias`),
  },
  (table) => [
    // Ensure an agent can only be linked to a project once
    unique(`unique_agent_project`).on(table.agentId, table.projectId),
  ]
)

export const agentProjectsRelations = relations(agentProjects, ({ one }) => ({
  agent: one(agents, {
    fields: [agentProjects.agentId],
    references: [agents.id],
  }),
  project: one(projects, {
    fields: [agentProjects.projectId],
    references: [projects.id],
  }),
}))

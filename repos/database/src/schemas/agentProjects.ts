import { relations } from 'drizzle-orm'
import { agents } from '@TDB/schemas/agents'
import { base } from '@TDB/utils/schema/base'
import { projects } from '@TDB/schemas/projects'
import { AgentProjectIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import {
  text,
  jsonb,
  boolean,
  integer,
  pgTable,
  unique,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * Agent-Projects junction table
 * Enables many-to-many relationship between agents and projects
 * One agent can be associated with multiple projects
 * One project can have multiple agents
 *
 * Also stores per-project override configuration for the agent.
 * NULL override fields = inherit from base agent config.
 */
export const agentProjects = pgTable(
  `agent_projects`,
  {
    ...base,
    id: entityId(AgentProjectIdPrefix),
    /** Agent reference */
    agentId: varchar(`agent_id`, { length: 10 })
      .references(() => agents.id, { onDelete: `cascade` })
      .notNull(),

    /** Project reference */
    projectId: varchar(`project_id`, { length: 10 })
      .references(() => projects.id, { onDelete: `cascade` })
      .notNull(),

    /** Optional display name or alias for this agent in the project context */
    alias: text(`alias`),

    // --- Project-level override fields ---
    // NULL = inherit from base agent, non-null = override for this project

    /** Override model identifier for this project */
    model: text(`model`),

    /** Override max tokens for this project */
    maxTokens: integer(`max_tokens`),

    /** Override system prompt for this project */
    systemPrompt: text(`system_prompt`),

    /** Override tools list for this project */
    tools: jsonb(`tools`).$type<string[] | null>(),

    /** Project-scoped function IDs assigned to this agent (project-only, not an override) */
    functionIds: jsonb(`function_ids`).$type<string[] | null>(),

    /** Override environment variables (deep merged with base, project wins) */
    envVars: jsonb(`env_vars`).$type<Record<string, string> | null>(),

    /** Override environment settings (deep merged with base, project wins) */
    environment: jsonb(`environment`).$type<{
      timeout?: number
      memory?: number
      streaming?: boolean
      temperature?: number
      maxRetries?: number
      options?: Record<string, any>
    } | null>(),

    /** Whether this agent is enabled in this project (default: true) */
    enabled: boolean(`enabled`).default(true),
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

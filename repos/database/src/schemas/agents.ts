import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { base } from '@TDB/utils/schema/base'
import { secrets } from '@TDB/schemas/secrets'
import { threads } from '@TDB/schemas/threads'
import { agentProjects } from '@TDB/schemas/agentProjects'
import { agentProviders } from '@TDB/schemas/agentProviders'
import { text, jsonb, boolean, pgTable, integer, varchar } from 'drizzle-orm/pg-core'

/**
 * Agents table
 * Stores AI agent configurations with agent-specific settings
 * Agents belong to organizations and can be associated with multiple projects and providers
 * Provider associations are managed via the agent_providers junction table
 */
export const agents = pgTable(`agents`, {
  ...base,
  name: text(`name`).notNull(),
  description: text(`description`),

  /** Organization this agent belongs to */
  orgId: varchar(`org_id`, { length: 10 })
    .references(() => orgs.id, { onDelete: `cascade` })
    .notNull(),

  /** System prompt for the agent */
  systemPrompt: text(`system_prompt`),

  /** Model identifier override (optional, uses provider default if not set) */
  model: text(`model`),

  /** Maximum tokens for agent responses */
  maxTokens: integer(`max_tokens`).default(100000),

  /** Tools/skills the agent has access to */
  tools: jsonb(`tools`).default(`[]`).$type<string[]>(),

  /** Environment variables for agent execution */
  envVars: jsonb(`env_vars`).default({}).$type<Record<string, string>>(),

  /** Agent execution environment settings */
  environment: jsonb(`environment`).default({}).$type<{
    /** Execution timeout in milliseconds */
    timeout?: number
    /** Maximum memory in MB */
    memory?: number
    /** Whether to enable streaming responses */
    streaming?: boolean
    /** Temperature for response generation */
    temperature?: number
    /** Maximum retries for API calls */
    maxRetries?: number
    /** Agent-specific options */
    options?: Record<string, any>
  }>(),

  /** Whether this agent is active and can be used */
  active: boolean(`active`).default(true),
})

export const agentsRelations = relations(agents, ({ one, many }) => ({
  org: one(orgs, {
    fields: [agents.orgId],
    references: [orgs.id],
  }),
  secrets: many(secrets),
  threads: many(threads),
  projects: many(agentProjects),
  providers: many(agentProviders),
}))

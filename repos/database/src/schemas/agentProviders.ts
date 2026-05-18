import { relations } from 'drizzle-orm'
import { agents } from '@TDB/schemas/agents'
import { base } from '@TDB/utils/schema/base'
import { providers } from '@TDB/schemas/providers'
import { AgentProviderIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { pgTable, unique, integer, index, varchar, text } from 'drizzle-orm/pg-core'

/**
 * Agent-Providers junction table
 * Enables many-to-many relationship between agents and providers
 * One agent can have multiple LLM providers configured (switchable)
 * One provider can be used by multiple agents
 * Priority field determines the default provider (0 = primary)
 */
export const agentProviders = pgTable(
  `agent_providers`,
  {
    ...base,
    id: entityId(AgentProviderIdPrefix),
    /** Agent reference */
    agentId: varchar(`agent_id`, { length: 10 })
      .references(() => agents.id, { onDelete: `cascade` })
      .notNull(),

    /** Provider reference */
    providerId: varchar(`provider_id`, { length: 10 })
      .references(() => providers.id, { onDelete: `cascade` })
      .notNull(),

    /** Priority order: 0 = primary/default provider, 1+ = secondary */
    priority: integer(`priority`).default(0),

    /** Per-provider model override: NULL = inherit from agent.model or provider.options.model */
    model: text(`model`),
  },
  (table) => [
    unique(`unique_agent_provider`).on(table.agentId, table.providerId),
    index(`idx_agent_provider_priority`).on(table.agentId, table.priority),
  ]
)

export const agentProvidersRelations = relations(agentProviders, ({ one }) => ({
  agent: one(agents, {
    references: [agents.id],
    fields: [agentProviders.agentId],
  }),
  provider: one(providers, {
    references: [providers.id],
    fields: [agentProviders.providerId],
  }),
}))

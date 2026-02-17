import { relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { agents } from '@TDB/schemas/agents'
import { functions } from '@TDB/schemas/functions'
import { uuid, pgTable, unique } from 'drizzle-orm/pg-core'

/**
 * Agent-Functions junction table
 * Enables many-to-many relationship between agents and functions
 * One agent can use multiple functions as tools
 * One function can be reused across multiple agents
 */
export const agentFunctions = pgTable(
  `agent_functions`,
  {
    ...base,
    /** Agent reference */
    agentId: uuid(`agent_id`)
      .references(() => agents.id, { onDelete: `cascade` })
      .notNull(),

    /** Function reference */
    functionId: uuid(`function_id`)
      .references(() => functions.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    // Ensure a function can only be linked to an agent once
    unique(`unique_agent_function`).on(table.agentId, table.functionId),
  ]
)

export const agentFunctionsRelations = relations(agentFunctions, ({ one }) => ({
  agent: one(agents, {
    fields: [agentFunctions.agentId],
    references: [agents.id],
  }),
  function: one(functions, {
    fields: [agentFunctions.functionId],
    references: [functions.id],
  }),
}))

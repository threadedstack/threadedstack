import type { TActiveInitiative, TStrategyBacklogItem } from '@tdsk/domain'

import { orgs } from '@TDB/schemas/orgs'
import { relations } from 'drizzle-orm'
import { agents } from '@TDB/schemas/agents'
import { base } from '@TDB/utils/schema/base'
import { CompanyStrategyIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { text, jsonb, pgTable, varchar } from 'drizzle-orm/pg-core'

/**
 * Company strategies table
 * The single org-level strategy artifact the CEO owns (AI Executive Layer SP1):
 * North Star + segments + positioning, a prioritized backlog, and exactly one
 * frozen Active Initiative. Injected into every exec + dev-loop cycle. Exactly
 * one row per org (org_id is unique).
 */
export const companyStrategies = pgTable(`company_strategies`, {
  ...base,
  id: entityId(CompanyStrategyIdPrefix),

  /** The durable "why": one-line company north star */
  northStar: text(`north_star`),

  /** Target segments */
  segments: jsonb(`segments`).default([]).$type<string[]>(),

  /** Positioning statement */
  positioning: text(`positioning`),

  /** Prioritized future initiatives, freely re-orderable */
  backlog: jsonb(`backlog`).default([]).$type<TStrategyBacklogItem[]>(),

  /** The single frozen Active Initiative, or null when none is in flight */
  activeInitiative: jsonb(`active_initiative`).$type<TActiveInitiative | null>(),

  orgId: varchar(`org_id`, { length: 10 })
    .references(() => orgs.id, { onDelete: `cascade` })
    .notNull()
    .unique(),

  updatedByAgentId: varchar(`updated_by_agent_id`, { length: 10 }).references(
    () => agents.id,
    { onDelete: `set null` }
  ),
})

export const companyStrategiesRelations = relations(companyStrategies, ({ one }) => ({
  org: one(orgs, {
    fields: [companyStrategies.orgId],
    references: [orgs.id],
  }),
  updatedByAgent: one(agents, {
    fields: [companyStrategies.updatedByAgentId],
    references: [agents.id],
  }),
}))

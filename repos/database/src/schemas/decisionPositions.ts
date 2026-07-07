import type { TStance } from '@tdsk/domain'

import { orgs } from '@TDB/schemas/orgs'
import { relations } from 'drizzle-orm'
import { agents } from '@TDB/schemas/agents'
import { base } from '@TDB/utils/schema/base'
import { DecisionPositionIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { decisionProposals } from '@TDB/schemas/decisionProposals'
import { text, index, unique, pgTable, varchar, integer } from 'drizzle-orm/pg-core'

/**
 * Decision positions table
 * A board member's per-round stance on a decision proposal (AI Executive Layer
 * SP1). Exactly one position per (proposal, agent, round) — the shared,
 * org-scoped deliberation channel every board member reads.
 */
export const decisionPositions = pgTable(
  `decision_positions`,
  {
    ...base,
    id: entityId(DecisionPositionIdPrefix),

    /** Stance for this round: endorse | object | amend */
    stance: varchar(`stance`, { length: 12 }).notNull().$type<TStance>(),

    reasoning: text(`reasoning`).notNull(),

    /** Deliberation round this position was posted in (matches the proposal's round) */
    round: integer(`round`).notNull(),

    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),

    proposalId: varchar(`proposal_id`, { length: 10 })
      .references(() => decisionProposals.id, { onDelete: `cascade` })
      .notNull(),

    agentId: varchar(`agent_id`, { length: 10 })
      .references(() => agents.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    index(`decision_positions_proposal_id_idx`).on(table.proposalId),
    unique(`unique_decision_position_round`).on(
      table.proposalId,
      table.agentId,
      table.round
    ),
  ]
)

export const decisionPositionsRelations = relations(decisionPositions, ({ one }) => ({
  org: one(orgs, {
    fields: [decisionPositions.orgId],
    references: [orgs.id],
  }),
  proposal: one(decisionProposals, {
    fields: [decisionPositions.proposalId],
    references: [decisionProposals.id],
  }),
  agent: one(agents, {
    fields: [decisionPositions.agentId],
    references: [agents.id],
  }),
}))

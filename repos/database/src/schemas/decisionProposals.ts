import type { TDecisionAxis, TDecisionStatus } from '@tdsk/domain'

import { orgs } from '@TDB/schemas/orgs'
import { relations } from 'drizzle-orm'
import { agents } from '@TDB/schemas/agents'
import { base } from '@TDB/utils/schema/base'
import { DecisionProposalIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { text, jsonb, index, pgTable, varchar, integer } from 'drizzle-orm/pg-core'

/**
 * Decision proposals table
 * Org-scoped board decisions (AI Executive Layer SP1). A board member opens a
 * proposal for a major direction change; members post per-round positions and the
 * proposal resolves on unanimous endorsement or a CEO tiebreak.
 * Lifecycle: open → deliberating → committed | tiebroken | rejected | aborted.
 */
export const decisionProposals = pgTable(
  `decision_proposals`,
  {
    ...base,
    id: entityId(DecisionProposalIdPrefix),

    title: text(`title`).notNull(),

    /** Company-direction axis: segment | positioning | pricing | active-initiative | resource-bet | other */
    axis: varchar(`axis`, { length: 20 }).notNull().$type<TDecisionAxis>(),

    description: text(`description`).notNull(),

    /** Evidence backing the proposal (metrics links, research refs, etc.) */
    evidence: jsonb(`evidence`).default([]).$type<string[]>(),

    /** Lifecycle: open | deliberating | committed | tiebroken | rejected | aborted */
    status: varchar(`status`, { length: 20 })
      .default(`open`)
      .notNull()
      .$type<TDecisionStatus>(),

    /** Current deliberation round (1-based) */
    round: integer(`round`).default(1).notNull(),

    /** Resolution rationale, set on commit / tiebreak / rejection */
    resolution: text(`resolution`),

    /** Commit ref: the strategy/backlog change or closing ref applied on resolution */
    resolvedRef: text(`resolved_ref`),

    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),

    openedByAgentId: varchar(`opened_by_agent_id`, { length: 10 })
      .references(() => agents.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    index(`decision_proposals_org_id_idx`).on(table.orgId),
    index(`decision_proposals_org_id_status_idx`).on(table.orgId, table.status),
  ]
)

export const decisionProposalsRelations = relations(decisionProposals, ({ one }) => ({
  org: one(orgs, {
    fields: [decisionProposals.orgId],
    references: [orgs.id],
  }),
  openedByAgent: one(agents, {
    fields: [decisionProposals.openedByAgentId],
    references: [agents.id],
  }),
}))

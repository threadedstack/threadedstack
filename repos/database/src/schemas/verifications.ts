import type { TVerifyProbe, TVerificationStatus } from '@tdsk/domain'

import { orgs } from '@TDB/schemas/orgs'
import { relations } from 'drizzle-orm'
import { agents } from '@TDB/schemas/agents'
import { base } from '@TDB/utils/schema/base'
import { escalations } from '@TDB/schemas/escalations'
import { VerificationIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import {
  text,
  jsonb,
  index,
  integer,
  pgTable,
  varchar,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

/**
 * Verifications table
 * Post-merge safety-net rows for steward PRs (P4c self-ownership).
 * After a PR merges + deploys the verify cycle runs the declared probe and
 * either marks the row verified or opens a revert PR + escalation.
 * Lifecycle: pending → verifying → verified | regressed.
 */
export const verifications = pgTable(
  `verifications`,
  {
    ...base,
    id: entityId(VerificationIdPrefix),

    /** GitHub PR number that triggered this verification. */
    prNumber: integer(`pr_number`).notNull(),

    /** GitHub PR URL for the merged PR. */
    prUrl: text(`pr_url`),

    /** The merge commit SHA (40-char), set once the PR merges. */
    mergeSha: varchar(`merge_sha`, { length: 40 }),

    /**
     * The probe to execute — parsed from the PR body's ```tdsk-verify``` block.
     * Defaults to DefaultVerifyProbe (ci-green) at the app layer when no block is present;
     * the row always stores a concrete probe.
     */
    probe: jsonb(`probe`).notNull().$type<TVerifyProbe>(),

    /** Lifecycle: pending | verifying | verified | regressed */
    status: varchar(`status`, { length: 12 })
      .default(`pending`)
      .notNull()
      .$type<TVerificationStatus>(),

    /** Free-text summary of the last probe run's outcome. */
    detail: text(`detail`),

    /** Set when the verify cycle opened a revert PR after a regression. */
    revertPrUrl: text(`revert_pr_url`),

    /**
     * FK to escalations.id — set when a regressed run filed an escalation.
     * Set null on escalation delete so the verification row survives.
     */
    escalationId: varchar(`escalation_id`, { length: 10 }).references(
      () => escalations.id,
      {
        onDelete: `set null`,
      }
    ),

    /** Citations and provenance: { threadId, messageId, scheduleId, model } */
    meta: jsonb(`meta`).$type<Record<string, any>>(),

    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),

    agentId: varchar(`agent_id`, { length: 10 })
      .references(() => agents.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    index(`verifications_org_id_agent_id_idx`).on(table.orgId, table.agentId),
    index(`verifications_status_idx`).on(table.status),
    uniqueIndex(`verifications_org_id_pr_number_uidx`).on(table.orgId, table.prNumber),
  ]
)

export const verificationsRelations = relations(verifications, ({ one }) => ({
  org: one(orgs, {
    fields: [verifications.orgId],
    references: [orgs.id],
  }),
  agent: one(agents, {
    fields: [verifications.agentId],
    references: [agents.id],
  }),
  escalation: one(escalations, {
    fields: [verifications.escalationId],
    references: [escalations.id],
  }),
}))

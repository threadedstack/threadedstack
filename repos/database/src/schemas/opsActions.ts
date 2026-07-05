import type {
  TOpsAction,
  TOpsActionResult,
  TOpsActionStatus,
  TOpsScanResult,
  TOpsRollback,
} from '@tdsk/domain'

import { orgs } from '@TDB/schemas/orgs'
import { relations } from 'drizzle-orm'
import { agents } from '@TDB/schemas/agents'
import { base } from '@TDB/utils/schema/base'
import { OpsActionIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { text, jsonb, index, boolean, pgTable, varchar } from 'drizzle-orm/pg-core'

/**
 * OpsActions audit table
 * Records every ops action the steward proposes and executes (P4d self-ownership).
 * Write-tier actions progress through: proposed → dryRun → executed | rejected | failed.
 * Read-tier actions are recorded with status=executed immediately after inline execution.
 */
export const opsActions = pgTable(
  `ops_actions`,
  {
    ...base,
    id: entityId(OpsActionIdPrefix),

    /** One of the seven allowlisted EOpsAction values. */
    action: varchar(`action`, { length: 40 }).notNull().$type<TOpsAction>(),

    /** Discriminated payload — shape depends on action. */
    params: jsonb(`params`).notNull().$type<Record<string, any>>(),

    /** Whether this row was created in dry-run mode. Default true for WRITE-tier safety. */
    dryRun: boolean(`dry_run`).default(true).notNull(),

    /** Result of the dry-run execution phase. */
    dryRunResult: jsonb(`dry_run_result`).$type<TOpsActionResult>(),

    /** Result of the real execution phase (null until executed). */
    result: jsonb(`result`).$type<TOpsActionResult>(),

    /** Lifecycle: proposed | dryRun | rejected | executed | failed */
    status: varchar(`status`, { length: 20 })
      .default(`proposed`)
      .notNull()
      .$type<TOpsActionStatus>(),

    /** Scanner findings from the D4 gate. */
    scanResult: jsonb(`scan_result`).$type<TOpsScanResult>(),

    /** Adversary / admin review verdict with approval flag, reason, and optional reviewer. */
    reviewVerdict: jsonb(`review_verdict`).$type<{
      approved: boolean
      reason: string
      by?: string
    }>(),

    /** Rollback data captured at dry-run time for use if execution fails. */
    rollback: jsonb(`rollback`).$type<TOpsRollback>(),

    /** Human-readable justification supplied by the steward when proposing the action. */
    reason: text(`reason`),

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
    index(`ops_actions_org_id_agent_id_idx`).on(table.orgId, table.agentId),
    index(`ops_actions_status_idx`).on(table.status),
    index(`ops_actions_org_id_status_idx`).on(table.orgId, table.status),
  ]
)

export const opsActionsRelations = relations(opsActions, ({ one }) => ({
  org: one(orgs, {
    fields: [opsActions.orgId],
    references: [orgs.id],
  }),
  agent: one(agents, {
    fields: [opsActions.agentId],
    references: [agents.id],
  }),
}))

import type { TEscalationStatus, TEscalationTarget } from '@tdsk/domain'

import { orgs } from '@TDB/schemas/orgs'
import { sql, relations } from 'drizzle-orm'
import { agents } from '@TDB/schemas/agents'
import { base } from '@TDB/utils/schema/base'
import { EscalationIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { text, jsonb, index, pgTable, varchar, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Escalations table
 * Agent-opened escalations for needs the steward cannot yet act on (P4b self-ownership).
 * Lifecycle: open → routed | resolved | rejected.
 * `secrets` target is a hard-line issue-only path; `app` target auto-routes.
 */
export const escalations = pgTable(
  `escalations`,
  {
    ...base,
    id: entityId(EscalationIdPrefix),

    title: text(`title`).notNull(),
    problem: text(`problem`).notNull(),

    /** Evidence backing the escalation (log lines, health snapshots, etc.) */
    evidence: jsonb(`evidence`).default([]).$type<string[]>(),

    /** Proposed code/config patch the agent thinks would resolve the issue */
    proposedPatch: text(`proposed_patch`),

    /** Target subsystem: app | ops | infra | secrets */
    target: varchar(`target`, { length: 12 }).notNull().$type<TEscalationTarget>(),

    /** Lifecycle: open | routed | resolved | rejected */
    status: varchar(`status`, { length: 12 })
      .default(`open`)
      .notNull()
      .$type<TEscalationStatus>(),

    /** Stable key used to collapse repeat escalations of the same underlying issue */
    dedupeKey: varchar(`dedupe_key`, { length: 200 }).notNull(),

    /** GitHub issue URL, populated after the escalation is filed externally */
    issueRef: text(`issue_ref`),

    /** PR url or closing ref that resolved the escalation */
    resolvedRef: text(`resolved_ref`),

    /** Rejection / veto reason */
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
    index(`escalations_org_id_agent_id_idx`).on(table.orgId, table.agentId),
    index(`escalations_status_idx`).on(table.status),
    index(`escalations_org_id_dedupe_key_idx`).on(table.orgId, table.dedupeKey),
    // Enforces "one open escalation per dedupe key" at the DB level so two
    // concurrent openEscalation() callers racing the same dedupeKey can't
    // both insert — the loser's INSERT ... ON CONFLICT DO NOTHING (see
    // Escalation.claimOpen) affects zero rows and is treated as "already
    // open elsewhere", not an error. Mirrors scheduleRuns' running-slot index.
    uniqueIndex(`escalations_org_id_dedupe_key_open_idx`)
      .on(table.orgId, table.dedupeKey)
      .where(sql`${table.status} IN ('open', 'routed')`),
  ]
)

export const escalationsRelations = relations(escalations, ({ one }) => ({
  org: one(orgs, {
    fields: [escalations.orgId],
    references: [orgs.id],
  }),
  agent: one(agents, {
    fields: [escalations.agentId],
    references: [agents.id],
  }),
}))

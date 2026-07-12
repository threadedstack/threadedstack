import type {
  TScanResult,
  TAuditVerdict,
  TTaskPriority,
  TTaskSourceSignal,
  TTaskProposalStatus,
} from '@tdsk/domain'
import type { AnyPgColumn } from 'drizzle-orm/pg-core'

import { orgs } from '@TDB/schemas/orgs'
import { sql, relations } from 'drizzle-orm'
import { agents } from '@TDB/schemas/agents'
import { base } from '@TDB/utils/schema/base'
import { TaskProposalIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { text, jsonb, index, pgTable, varchar, uniqueIndex } from 'drizzle-orm/pg-core'

/**
 * Task proposals table
 * Self-sensed tasks moving through an automatic gate (P4a self-direction).
 * Lifecycle: pending → (deterministic security scan) → scanned → promoted | rejected.
 * task_proposals ARE the backlog — scanned proposals are picked up by the work
 * cycle, which opens a CI-gated PR and marks the proposal promoted (with prUrl).
 */
export const taskProposals = pgTable(
  `task_proposals`,
  {
    ...base,
    id: entityId(TaskProposalIdPrefix),

    title: text(`title`).notNull(),
    description: text(`description`).notNull(),

    /** Priority tier: P0 (highest) → P4 (lowest) */
    priority: varchar(`priority`, { length: 4 }).$type<TTaskPriority>(),

    /** Evidence backing the proposal (log line, marker diff, health snapshot) */
    evidence: text(`evidence`).notNull(),

    /** Sensor that originated the proposal: ci | deploy-marker | health | ... */
    sourceSignal: varchar(`source_signal`, { length: 20 }).$type<TTaskSourceSignal>(),

    /** Stable key used to collapse repeat sensings of the same underlying task */
    dedupeKey: varchar(`dedupe_key`, { length: 200 }).notNull(),

    /** Repos the task is expected to touch */
    repos: jsonb(`repos`).default([]).$type<string[]>(),

    /** Lifecycle: pending | scanned | rejected | promoted */
    status: varchar(`status`, { length: 20 })
      .default(`pending`)
      .notNull()
      .$type<TTaskProposalStatus>(),

    /** Deterministic security scan result: { passed, findings } */
    scanResult: jsonb(`scan_result`).$type<TScanResult>(),

    /** Async admin/auditor decision: { approved, reason, by } */
    auditVerdict: jsonb(`audit_verdict`).$type<TAuditVerdict>(),

    /** Citations and provenance: { threadId, messageId, scheduleId, model } */
    meta: jsonb(`meta`).$type<Record<string, any>>(),

    /** Set when promoted — the CI-gated PR opened for this task */
    prUrl: text(`pr_url`),

    /** Rejection / veto reason */
    reason: text(`reason`),

    /** Long-lived initiative this task rolls up into (P4f) */
    initiative: text(`initiative`),

    /** Self-referencing parent for task decomposition (P4f) */
    parentId: varchar(`parent_id`, { length: 10 }).references(
      (): AnyPgColumn => taskProposals.id,
      { onDelete: `set null` }
    ),

    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),

    agentId: varchar(`agent_id`, { length: 10 })
      .references(() => agents.id, { onDelete: `cascade` })
      .notNull(),
  },
  (table) => [
    index(`task_proposals_org_id_agent_id_idx`).on(table.orgId, table.agentId),
    index(`task_proposals_status_idx`).on(table.status),
    index(`task_proposals_org_id_dedupe_key_status_idx`).on(
      table.orgId,
      table.dedupeKey,
      table.status
    ),
    index(`task_proposals_parent_id_idx`).on(table.parentId),
    // Enforces "one open (pending/scanned) proposal per dedupeKey" at the DB level
    // so two concurrent authorTaskProposal() callers can't both pass the
    // check-then-insert TOCTOU race — the loser's INSERT ... ON CONFLICT DO NOTHING
    // (see TaskProposal.createIfAbsent) affects zero rows and is treated as "an open
    // row already exists", not an error. Mirrors scheduleRuns' running-slot index.
    uniqueIndex(`task_proposals_org_id_dedupe_key_open_idx`)
      .on(table.orgId, table.dedupeKey)
      .where(sql`${table.status} IN ('pending', 'scanned')`),
  ]
)

export const taskProposalsRelations = relations(taskProposals, ({ one, many }) => ({
  org: one(orgs, {
    fields: [taskProposals.orgId],
    references: [orgs.id],
  }),
  agent: one(agents, {
    fields: [taskProposals.agentId],
    references: [agents.id],
  }),
  parent: one(taskProposals, {
    fields: [taskProposals.parentId],
    references: [taskProposals.id],
    relationName: `taskProposalChildren`,
  }),
  children: many(taskProposals, { relationName: `taskProposalChildren` }),
}))

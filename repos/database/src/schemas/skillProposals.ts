import type { TScanResult, TAuditVerdict, TSkillProposalStatus } from '@tdsk/domain'

import { orgs } from '@TDB/schemas/orgs'
import { relations } from 'drizzle-orm'
import { skills } from '@TDB/schemas/skills'
import { agents } from '@TDB/schemas/agents'
import { base } from '@TDB/utils/schema/base'
import { SkillProposalIdPrefix } from '@tdsk/domain'
import { entityId } from '@TDB/utils/schema/entityId'
import { text, jsonb, index, boolean, pgTable, varchar } from 'drizzle-orm/pg-core'

/**
 * Skill proposals table
 * Self-authored skills pending automatic promotion (P3b self-improvement).
 * Lifecycle: pending → (security scan) → scanned → (auditor review) → promoted | rejected.
 * A promoted proposal creates an active `skills` row (promotedSkillId).
 */
export const skillProposals = pgTable(
  `skill_proposals`,
  {
    ...base,
    id: entityId(SkillProposalIdPrefix),

    name: text(`name`).notNull(),
    description: text(`description`).notNull(),
    instructions: text(`instructions`).notNull(),
    triggerKeywords: jsonb(`trigger_keywords`).default([]).$type<string[]>(),
    tools: jsonb(`tools`).default([]).$type<string[]>(),
    alwaysActive: boolean(`always_active`).default(false).notNull(),

    /** Lifecycle: pending | scanned | rejected | promoted */
    status: varchar(`status`, { length: 20 })
      .default(`pending`)
      .notNull()
      .$type<TSkillProposalStatus>(),

    /** Deterministic security scan result: { passed, findings } */
    scanResult: jsonb(`scan_result`).$type<TScanResult>(),

    /** Auditor/human decision: { approved, reason, by } */
    auditVerdict: jsonb(`audit_verdict`).$type<TAuditVerdict>(),

    /** Set when promoted — the active skill created from this proposal */
    promotedSkillId: varchar(`promoted_skill_id`, { length: 10 }).references(
      () => skills.id,
      { onDelete: `set null` }
    ),

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
    index(`skill_proposals_org_id_agent_id_idx`).on(table.orgId, table.agentId),
    index(`skill_proposals_status_idx`).on(table.status),
  ]
)

export const skillProposalsRelations = relations(skillProposals, ({ one }) => ({
  org: one(orgs, {
    fields: [skillProposals.orgId],
    references: [orgs.id],
  }),
  agent: one(agents, {
    fields: [skillProposals.agentId],
    references: [agents.id],
  }),
  promotedSkill: one(skills, {
    fields: [skillProposals.promotedSkillId],
    references: [skills.id],
  }),
}))

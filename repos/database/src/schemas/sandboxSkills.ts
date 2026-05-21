import { relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { skills } from '@TDB/schemas/skills'
import { projects } from '@TDB/schemas/projects'
import { sandboxes } from '@TDB/schemas/sandboxes'
import { entityId } from '@TDB/utils/schema/entityId'
import { SandboxSkillIdPrefix } from '@tdsk/domain'
import { sql } from 'drizzle-orm'
import { index, integer, pgTable, uniqueIndex, varchar } from 'drizzle-orm/pg-core'

export const sandboxSkills = pgTable(
  `sandbox_skills`,
  {
    ...base,
    id: entityId(SandboxSkillIdPrefix),
    sandboxId: varchar(`sandbox_id`, { length: 10 })
      .references(() => sandboxes.id, { onDelete: `cascade` })
      .notNull(),

    skillId: varchar(`skill_id`, { length: 10 })
      .references(() => skills.id, { onDelete: `cascade` })
      .notNull(),

    projectId: varchar(`project_id`, { length: 10 }).references(() => projects.id, {
      onDelete: `cascade`,
    }),

    priority: integer(`priority`).default(0),
  },
  (table) => [
    index(`idx_sandbox_skill_sandbox`).on(table.sandboxId),
    index(`idx_sandbox_skill_sandbox_project`).on(table.sandboxId, table.projectId),
    uniqueIndex(`unique_sandbox_skill_org`)
      .on(table.sandboxId, table.skillId)
      .where(sql`project_id IS NULL`),
    uniqueIndex(`unique_sandbox_skill_project`)
      .on(table.sandboxId, table.skillId, table.projectId)
      .where(sql`project_id IS NOT NULL`),
  ]
)

export const sandboxSkillsRelations = relations(sandboxSkills, ({ one }) => ({
  sandbox: one(sandboxes, {
    references: [sandboxes.id],
    fields: [sandboxSkills.sandboxId],
  }),
  skill: one(skills, {
    references: [skills.id],
    fields: [sandboxSkills.skillId],
  }),
  project: one(projects, {
    references: [projects.id],
    fields: [sandboxSkills.projectId],
  }),
}))

import type { TKubeSandboxConfig } from '@tdsk/domain'

import { customAlphabet } from 'nanoid'
import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { base } from '@TDB/utils/schema/base'
import { SandboxIdPrefix } from '@tdsk/domain'
import { projects } from '@TDB/schemas/projects'
import { sandboxProviders } from '@TDB/schemas/sandboxProviders'
import { text, jsonb, uuid, varchar, boolean, index, pgTable } from 'drizzle-orm/pg-core'

/**
 * Required custom alphabet for sandbox ids due to ssh / sync implementation
 * The sandbox id is used in ssh connections for file syncing
 * ssh enforces all lowercase values, so we must align with that constraint
 * The ids must perfectly match, so we need to ensure all sandbox ids are lowercase
 */
const sandboxNanoid = customAlphabet(`0123456789abcdefghijklmnopqrstuvwxyz`, 7)

export const sandboxes = pgTable(
  `sandboxes`,
  {
    ...base,
    id: varchar(`id`, { length: 10 })
      .notNull()
      .primaryKey()
      .$defaultFn(() => `${SandboxIdPrefix}${sandboxNanoid()}`),
    name: text(`name`).notNull(),
    orgId: varchar(`org_id`, { length: 10 })
      .references(() => orgs.id, { onDelete: `cascade` })
      .notNull(),
    userId: uuid(`user_id`).references(() => users.id, { onDelete: `set null` }),
    projectId: varchar(`project_id`, { length: 10 }).references(() => projects.id, {
      onDelete: `cascade`,
    }),
    config: jsonb(`config`).notNull().$type<TKubeSandboxConfig>(),
    builtIn: boolean(`built_in`).notNull().default(false),
  },
  (table) => [
    index(`sandboxes_org_idx`).on(table.orgId),
    index(`sandboxes_org_user_idx`).on(table.orgId, table.userId),
    index(`sandboxes_project_idx`).on(table.projectId),
  ]
)

export const sandboxesRelations = relations(sandboxes, ({ one, many }) => ({
  org: one(orgs, {
    references: [orgs.id],
    fields: [sandboxes.orgId],
  }),
  user: one(users, {
    references: [users.id],
    fields: [sandboxes.userId],
  }),
  project: one(projects, {
    references: [projects.id],
    fields: [sandboxes.projectId],
  }),
  providers: many(sandboxProviders),
}))

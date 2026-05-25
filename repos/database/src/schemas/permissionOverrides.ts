import type { TPermission } from '@tdsk/domain'

import { orgs } from '@TDB/schemas/orgs'
import { users } from '@TDB/schemas/users'
import { sql, relations } from 'drizzle-orm'
import { base } from '@TDB/utils/schema/base'
import { projects } from '@TDB/schemas/projects'
import { entityId } from '@TDB/utils/schema/entityId'
import { PermissionOverrideIdPrefix } from '@tdsk/domain'
import {
  uuid,
  text,
  check,
  index,
  pgTable,
  varchar,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'

export const permissionOverrides = pgTable(
  `permission_overrides`,
  {
    ...base,
    id: entityId(PermissionOverrideIdPrefix),
    permission: text(`permission`).notNull().$type<TPermission>(),
    effect: text(`effect`).notNull().$type<`grant` | `deny`>(),
    userId: uuid(`user_id`)
      .references(() => users.id, { onDelete: `cascade` })
      .notNull(),
    orgId: varchar(`org_id`, { length: 10 }).references(() => orgs.id, {
      onDelete: `cascade`,
    }),
    projectId: varchar(`project_id`, { length: 10 }).references(() => projects.id, {
      onDelete: `cascade`,
    }),
    grantedBy: uuid(`granted_by`)
      .references(() => users.id, { onDelete: `cascade` })
      .notNull(),
    reason: text(`reason`),
    expiresAt: timestamp(`expires_at`, { mode: `string` }),
  },
  (table) => [
    check(
      `permission_override_scope_check`,
      sql`
    (${table.orgId} IS NOT NULL AND ${table.projectId} IS NULL) OR
    (${table.orgId} IS NULL AND ${table.projectId} IS NOT NULL)
  `
    ),
    check(`permission_override_effect_check`, sql`${table.effect} IN ('grant', 'deny')`),
    uniqueIndex(`permission_overrides_user_org_perm_idx`)
      .on(table.userId, table.orgId, table.permission)
      .where(sql`${table.orgId} IS NOT NULL`),
    uniqueIndex(`permission_overrides_user_project_perm_idx`)
      .on(table.userId, table.projectId, table.permission)
      .where(sql`${table.projectId} IS NOT NULL`),
    index(`permission_overrides_user_id_idx`).on(table.userId),
    index(`permission_overrides_org_id_idx`).on(table.orgId),
    index(`permission_overrides_project_id_idx`).on(table.projectId),
  ]
)

export const permissionOverridesRelations = relations(permissionOverrides, ({ one }) => ({
  user: one(users, {
    fields: [permissionOverrides.userId],
    references: [users.id],
    relationName: `overrideUser`,
  }),
  org: one(orgs, { fields: [permissionOverrides.orgId], references: [orgs.id] }),
  project: one(projects, {
    fields: [permissionOverrides.projectId],
    references: [projects.id],
  }),
  grantor: one(users, {
    fields: [permissionOverrides.grantedBy],
    references: [users.id],
    relationName: `overrideGrantor`,
  }),
}))

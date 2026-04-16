import { relations } from 'drizzle-orm'
import { roles } from '@TDB/schemas/roles'
import { assets } from '@TDB/schemas/assets'
import { quotas } from '@TDB/schemas/quotas'
import { base } from '@TDB/utils/schema/base'
import { users } from '@TDB/schemas/users'
import { secrets } from '@TDB/schemas/secrets'
import { projects } from '@TDB/schemas/projects'
import { providers } from '@TDB/schemas/providers'
import { agents } from '@TDB/schemas/agents'
import { uuid, text, jsonb, pgTable, index } from 'drizzle-orm/pg-core'
import type { TOrgConfig } from '@tdsk/domain'
import { invitations } from '@TDB/schemas/invitations'

export const orgs = pgTable(
  `organizations`,
  {
    ...base,
    name: text(`name`).notNull(),
    description: text(`description`),

    config: jsonb(`config`).$type<TOrgConfig>(),

    /** User who owns this organization — determines subscription/quota limits */
    ownerId: uuid(`owner_id`)
      .references(() => users.id)
      .notNull(),
  },
  (table) => [index(`orgs_owner_id_idx`).on(table.ownerId)]
)

export const orgsRelations = relations(orgs, ({ one, many }) => ({
  owner: one(users, { fields: [orgs.ownerId], references: [users.id] }),
  users: many(roles),
  quotas: many(quotas),
  assets: many(assets),
  agents: many(agents),
  secrets: many(secrets),
  projects: many(projects),
  providers: many(providers),
  invitations: many(invitations),
}))

import { relations } from 'drizzle-orm'
import { roles } from '@TDB/schemas/roles'
import { assets } from '@TDB/schemas/assets'
import { quotas } from '@TDB/schemas/quotas'
import { base } from '@TDB/utils/schema/base'
import { secrets } from '@TDB/schemas/secrets'
import { projects } from '@TDB/schemas/projects'
import { providers } from '@TDB/schemas/providers'
import { agents } from '@TDB/schemas/agents'
import { text, pgTable } from 'drizzle-orm/pg-core'
import { invitations } from '@TDB/schemas/invitations'

export const orgs = pgTable(`organizations`, {
  ...base,
  name: text(`name`).notNull(),
  description: text(`description`),
})

export const orgsRelations = relations(orgs, ({ many }) => ({
  users: many(roles),
  quotas: many(quotas),
  assets: many(assets),
  agents: many(agents),
  secrets: many(secrets),
  projects: many(projects),
  providers: many(providers),
  invitations: many(invitations),
}))

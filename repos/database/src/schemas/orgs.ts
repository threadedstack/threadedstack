import { relations } from 'drizzle-orm'
import { roles } from '@TDB/schemas/roles'
import { assets } from '@TDB/schemas/assets'
import { base } from '@TDB/utils/schema/base'
import { quotas } from '@TDB/schemas/quotas'
import { secrets } from '@TDB/schemas/secrets'
import { configs } from '@TDB/schemas/configs'
import { projects } from '@TDB/schemas/projects'
import { providers } from '@TDB/schemas/providers'
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
  secrets: many(secrets),
  configs: many(configs),
  projects: many(projects),
  providers: many(providers),
  invitations: many(invitations),
}))

import { relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { base } from '@TDB/utils/schema/base'
import { projects } from '@TDB/schemas/projects'
import { pgTable, text, timestamp, boolean } from 'drizzle-orm/pg-core'

/**
 * Domains table for custom user domains
 * Supports on-demand TLS certificate generation
 */
export const domains = pgTable(`domains`, {
  ...base,

  // Domain name (e.g., 'app.example.com')
  domain: text(`domain`).notNull().unique(),

  // Verification timestamp
  verifiedAt: timestamp(`verified_at`),
  // SSL certificate details (stored by Caddy in PostgreSQL)
  sslPrivateKey: text(`ssl_private_key`),
  sslCertificate: text(`ssl_certificate`),
  sslExpiresAt: timestamp(`ssl_expires_at`),
  // Domain verification status
  verified: boolean(`verified`).notNull().default(false),
  // SSL certificate status
  sslEnabled: boolean(`ssl_enabled`).notNull().default(false),
  // Domain ownership via Exclusive Arc pattern
  // Only one of these should be set
  orgId: text(`org_id`).references(() => orgs.id, { onDelete: `cascade` }),
  projectId: text(`project_id`).references(() => projects.id, { onDelete: `cascade` }),
})

export const domainsRelations = relations(domains, ({ one }) => ({
  org: one(orgs, {
    fields: [domains.orgId],
    references: [orgs.id],
  }),
  project: one(projects, {
    fields: [domains.projectId],
    references: [projects.id],
  }),
}))

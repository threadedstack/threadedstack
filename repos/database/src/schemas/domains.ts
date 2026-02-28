import { sql, relations } from 'drizzle-orm'
import { orgs } from '@TDB/schemas/orgs'
import { base } from '@TDB/utils/schema/base'
import { projects } from '@TDB/schemas/projects'
import { certificates } from '@TDB/schemas/certificates'
import {
  uniqueIndex,
  pgTable,
  text,
  timestamp,
  boolean,
  check,
  varchar,
} from 'drizzle-orm/pg-core'

/**
 * Domains table for custom user domains
 * Supports on-demand TLS certificate generation via Caddy or manually uploaded
 *
 * SSL certificates are stored by Caddy in the caddy_certmagic_objects table
 * (managed by caddy-storage-postgresql plugin)
 */
export const domains = pgTable(
  `domains`,
  {
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
    // SSL certificate status (whether SSL has been enabled)
    sslEnabled: boolean(`ssl_enabled`).notNull().default(false),
    // Domain ownership via Exclusive Arc pattern
    // Only one of these should be set
    orgId: varchar(`org_id`, { length: 10 }).references(() => orgs.id, {
      onDelete: `cascade`,
    }),
    projectId: varchar(`project_id`, { length: 10 }).references(() => projects.id, {
      onDelete: `cascade`,
    }),
  },
  (table) => [
    uniqueIndex(`domains_org_id_domain_idx`).on(table.orgId, table.domain),
    check(
      `domain_owner_check`,
      sql`
    (
      (${table.orgId} IS NOT NULL)::int +
      (${table.projectId} IS NOT NULL)::int
    ) = 1
  `
    ),
  ]
)

export const domainsRelations = relations(domains, ({ one, many }) => ({
  org: one(orgs, {
    fields: [domains.orgId],
    references: [orgs.id],
  }),
  project: one(projects, {
    fields: [domains.projectId],
    references: [projects.id],
  }),
  certificates: many(certificates),
}))

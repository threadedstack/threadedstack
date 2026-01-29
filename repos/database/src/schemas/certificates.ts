/**
 * IMPORTANT - Do not export this file from '@TDB/schemas/schemas'
 * This schema is managed by caddy-storage-postgresql plugin, not drizzle
 * It only exists so it can be queried.
 *
 * This table is automatically created by the caddy-storage-postgresql plugin
 * See: https://github.com/dmarcwise/caddy-storage-postgresql
 */
import { sql, relations } from 'drizzle-orm'
import { domains } from '@TDB/schemas/domains'
import {
  text,
  check,
  boolean,
  pgTable,
  timestamp,
  primaryKey,
  customType,
} from 'drizzle-orm/pg-core'

/**
 * Custom type for PostgreSQL bytea (binary data)
 * Used for storing certificate content
 */
const byteaType = customType<{
  data: Buffer
  notNull: false
  default: false
}>({
  dataType() {
    return `bytea`
  },
})

/**
 * Caddy CertMagic storage table for TLS certificates
 * Stores certificate data, private keys, and metadata
 */
export const certificates = pgTable(
  `caddy_certmagic_objects`,
  {
    // Parent directory/path for the object
    parent: text(`parent`).notNull(),
    // Object name (e.g., certificate file name)
    name: text(`name`).notNull(),
    // Whether this is a file (true) or directory (false)
    isFile: boolean(`is_file`).notNull(),
    // File content (only for files, NULL for directories)
    value: byteaType(`value`),
    // Last modification timestamp
    modified: timestamp(`modified`).notNull().defaultNow(),
  },
  (table) => [
    // Primary key on parent + name combination
    primaryKey({ columns: [table.parent, table.name] }),
    check(
      `caddy_certmagic_objects_chk`,
      sql`(
        (is_file = true AND value IS NOT NULL) OR
        (is_file = false AND value IS NULL)
      )`
    ),
  ]
)

export const certificatesRelations = relations(certificates, ({ one }) => ({
  // Relation to domains table via parent field
  // The parent field contains the domain name
  domain: one(domains, {
    fields: [certificates.parent],
    references: [domains.domain],
  }),
}))

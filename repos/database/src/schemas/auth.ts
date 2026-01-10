/**
 * IMPORTANT - Do not export this file from '@TDB/schemas/schemas'
 * This schema is managed by neon, not drizzle so should not be included in migrations
 * It only exists so it can be read.
 */
import { pgSchema, text, timestamp, boolean, uuid } from 'drizzle-orm/pg-core'

const authSchema = pgSchema(`neon_auth`)

export const auth = authSchema.table(`users`, {
  id: uuid(`id`).primaryKey().notNull(),
  name: text(`name`),
  email: text(`email`),
  image: text(`images`),
  role: text(`role`),
  banned: boolean(`banned`),
  banReason: text(`banReason`),
  banExpires: timestamp(`banReason`),
  emailVerified: boolean(`emailVerified`),
  createdAt: timestamp(`createdAt`, { mode: `string` }).notNull(),
  updatedAt: timestamp(`updatedAt`, { mode: `string` }).notNull(),
})

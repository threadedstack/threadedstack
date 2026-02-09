/**
 * IMPORTANT - Do not export this file from '@TDB/schemas/schemas'
 * This schema is managed by neon, not drizzle so should not be included in migrations
 * It only exists so it can be read.
 */
import { relations } from 'drizzle-orm'
import { roles } from '@TDB/schemas/roles'
import { assets } from '@TDB/schemas/assets'
import { threads } from '@TDB/schemas/threads'
import { providers } from '@TDB/schemas/providers'
import { subscriptions } from '@TDB/schemas/subscriptions'
import { pgSchema, text, timestamp, boolean, uuid } from 'drizzle-orm/pg-core'

const authSchema = pgSchema(`neon_auth`)

export const users = authSchema.table(`user`, {
  id: uuid(`id`).primaryKey().notNull(),
  name: text(`name`),
  email: text(`email`),
  image: text(`image`),
  role: text(`role`),
  banned: boolean(`banned`),
  banReason: text(`banReason`),
  banExpires: timestamp(`banExpires`),
  emailVerified: boolean(`emailVerified`),
  createdAt: timestamp(`createdAt`, { mode: `string` }).notNull(),
  updatedAt: timestamp(`updatedAt`, { mode: `string` }).notNull(),
})

export const usersRelations = relations(users, ({ many, one }) => ({
  orgs: many(roles),
  roles: many(roles),
  assets: many(assets),
  threads: many(threads),
  providers: many(providers),
  subscription: one(subscriptions),
}))

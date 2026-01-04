import { relations } from 'drizzle-orm'
import { roles } from '@TDB/schemas/roles'
import { assets } from '@TDB/schemas/assets'
import { base } from '@TDB/utils/schema/base'
import { threads } from '@TDB/schemas/threads'
import { providers } from '@TDB/schemas/providers'
import { pgTable, varchar, uniqueIndex } from "drizzle-orm/pg-core"

export const users = pgTable(`users`, {
  ...base,
  first: varchar({ length: 255 }).notNull(),
  last: varchar({ length: 255 }).notNull(),
  photoUrl: varchar({ length: 255 }),
  provider: varchar({ length: 255 }).notNull(),
  altEmail: varchar(`alt_email`, { length: 255 }),
  email: varchar(`email`, { length: 255 }).notNull().unique(),
  displayName: varchar(`display_name`, { length: 255 }).notNull(),
},
  (table) => [uniqueIndex(`email_idx`).on(table.email)]
)

export const usersRelations = relations(users, ({ many }) => ({
  teams: many(roles),
  roles: many(roles),
  assets: many(assets),
  threads: many(threads),
  providers: many(providers),
}))

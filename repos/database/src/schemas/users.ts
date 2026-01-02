import { base } from '@TDB/utils/schema/base'
import { pgTable, varchar, uniqueIndex } from "drizzle-orm/pg-core"

export const users = pgTable(`users`, {
  ...base,
  first: varchar({ length: 255 }).notNull(),
  last: varchar({ length: 255 }).notNull(),
  photoUrl: varchar({ length: 255 }),
  provider: varchar({ length: 255 }).notNull(),
  displayName: varchar({ length: 255 }).notNull(),
  email: varchar({ length: 255 }).notNull().unique(),
},
  (table) => [
    uniqueIndex(`email_idx`).on(table.email)
  ]
)

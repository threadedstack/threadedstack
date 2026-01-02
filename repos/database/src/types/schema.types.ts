import type { users } from '@TDB/schemas/users'

export type TDBUserSelect = typeof users.$inferSelect
export type TDBUserInsert = typeof users.$inferInsert

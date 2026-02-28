import { nanoid } from 'nanoid'
import { varchar } from 'drizzle-orm/pg-core'
import { timestamps } from '@TDB/utils/schema/timestamps'

export const base = {
  id: varchar(`id`, { length: 10 })
    .notNull()
    .primaryKey()
    .$defaultFn(() => nanoid(10)),
  ...timestamps,
}

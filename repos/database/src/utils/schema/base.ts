import { uuid } from 'drizzle-orm/pg-core'
import { timestamps } from '@TDB/utils/schema/timestamps'

export const base = {
  id: uuid(`id`).defaultRandom().primaryKey(),
  ...timestamps,
}

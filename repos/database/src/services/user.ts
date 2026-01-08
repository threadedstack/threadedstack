import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBUserSelect, TDBUserInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { users } from '@TDB/schemas/users'

export type TUserOpts = {
  db: NodePgDatabase
}

export class User extends Base<typeof users, TDBUserSelect, TDBUserInsert> {
  constructor(opts: TUserOpts) {
    super({ ...opts, schema: users })
  }
}

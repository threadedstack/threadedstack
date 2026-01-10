import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBAuthSelect, TDBAuthInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { auth } from '@TDB/schemas/auth'

export type TAuthOpts = {
  db: NodePgDatabase
}

export class Auth extends Base<typeof auth, TDBAuthSelect, TDBAuthInsert> {
  constructor(opts: TAuthOpts) {
    super({ ...opts, table: auth })
  }
}

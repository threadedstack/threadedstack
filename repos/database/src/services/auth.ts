import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBAuthSelect, TDBAuthInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { auth } from '@TDB/schemas/auth'
import { User as UserModel } from '@tdsk/domain'

export type TAuthOpts = {
  db: NodePgDatabase
}

export class Auth extends Base<typeof auth, TDBAuthSelect, TDBAuthInsert, UserModel> {
  constructor(opts: TAuthOpts) {
    super({ ...opts, table: auth })
  }

  #convert = (data: TDBAuthSelect) => new UserModel(data)
}

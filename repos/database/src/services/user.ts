import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBUserSelect, TDBUserInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { users } from '@TDB/schemas/users'
import { User as UserModel } from '@tdsk/domain'

export type TUserOpts = {
  db: NodePgDatabase
}

export class User extends Base<typeof users, TDBUserSelect, TDBUserInsert, UserModel> {
  constructor(opts: TUserOpts) {
    super({ ...opts, table: users })
  }

  #convert = (data: TDBUserSelect) => {
    console.log(`------- users convert -------`)

    return new UserModel(data)
  }
}

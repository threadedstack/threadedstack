import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBUserSelect, TDBUserInsert } from '@TDB/types'

import { eq, and } from 'drizzle-orm'
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

  model = (data: TDBUserSelect) => {
    return new UserModel(data)
  }

  byEmail = async (email: string) => {
    try {
      const result = await this.db
        .select()
        .from(users)
        .where(and(eq(users.email, email)))
        .limit(1)

      return { data: this.model(result[0]) }
    } catch (error) {
      return { error }
    }
  }
}

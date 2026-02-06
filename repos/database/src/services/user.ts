import type { TServiceOpts, TDBUserSelect, TDBUserInsert } from '@TDB/types'

import { eq, and } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { users } from '@TDB/schemas/users'
import { User as UserModel } from '@tdsk/domain'

export class User extends Base<typeof users, TDBUserSelect, TDBUserInsert, UserModel> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: users })
  }

  model = (data: TDBUserSelect) => {
    return new UserModel(data as UserModel)
  }

  byEmail = async (email: string) => {
    try {
      const result = await this.db
        .select()
        .from(users)
        .where(and(eq(users.email, email)))
        .limit(1)

      return { data: this.model(result[0] as TDBUserSelect) }
    } catch (error) {
      return { error }
    }
  }
}

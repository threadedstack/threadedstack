import type {
  TServiceOpts,
  TDBUserSelect,
  TDBUserInsert,
  TDBApiResType,
} from '@TDB/types'

import { Base } from '@TDB/services/base'
import { users } from '@TDB/schemas/users'
import { eq, inArray } from 'drizzle-orm'
import { DBError } from '@TDB/utils/error/error'
import { User as UserModel } from '@tdsk/domain'

type TUserResp = TDBApiResType<UserModel>

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
        .where(eq(users.email, email))
        .limit(1)

      if (!result[0]) return { error: new DBError(`User not found`) }

      return { data: this.model(result[0] as TDBUserSelect) } as TUserResp
    } catch (error) {
      return { error } as TUserResp
    }
  }

  getByIds = async (ids: string[]): Promise<TDBApiResType<UserModel[]>> => {
    try {
      if (!ids.length) return { data: [] }

      const result = await this.db.select().from(users).where(inArray(users.id, ids))

      return { data: result.map((row) => this.model(row as TDBUserSelect)) }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }
}

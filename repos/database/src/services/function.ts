import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBApiResType,
  TDBFunctionSelect,
  TDBFunctionInsert,
} from '@TDB/types'

import { inArray } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { functions } from '@TDB/schemas/functions'
import { Function as FunctionModel } from '@tdsk/domain'

export class Function extends Base<
  typeof functions,
  TDBFunctionSelect,
  TDBFunctionInsert,
  FunctionModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: functions })
  }

  with = (opts?: TDBWithRecord) =>
    ({
      ...opts,
    }) as TDBWithRecord

  model = (data: TDBFunctionSelect) => {
    return new FunctionModel(data)
  }

  async get(id: string, opts?: TDBQueryOpts) {
    return super.get(id, { ...opts, with: this.with(opts?.with) })
  }

  async list(opts: TDBQueryOpts = {}) {
    return super.list({ ...opts, with: this.with(opts?.with) })
  }

  getByIds = async (ids: string[]): Promise<TDBApiResType<FunctionModel[]>> => {
    try {
      if (!ids.length) return { data: [] }

      const result = await this.db
        .select()
        .from(functions)
        .where(inArray(functions.id, ids))

      return { data: result.map((row) => this.model(row as TDBFunctionSelect)) }
    } catch (err) {
      return { error: err instanceof Error ? err : new Error(String(err)) }
    }
  }
}

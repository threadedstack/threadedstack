import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBWithRecord,
  TDBFunctionSelect,
  TDBFunctionInsert,
} from '@TDB/types'

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
}

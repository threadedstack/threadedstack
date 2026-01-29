import type { TDatabase, TDBFunctionSelect, TDBFunctionInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { functions } from '@TDB/schemas/functions'
import { Function as FunctionModel } from '@tdsk/domain'

export type TFunctionOpts = {
  db: TDatabase
}

export class Function extends Base<
  typeof functions,
  TDBFunctionSelect,
  TDBFunctionInsert,
  FunctionModel
> {
  constructor(opts: TFunctionOpts) {
    super({ ...opts, table: functions })
  }
  model = (data: TDBFunctionSelect) => new FunctionModel(data)
}

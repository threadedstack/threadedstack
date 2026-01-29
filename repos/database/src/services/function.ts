import type { TServiceOpts, TDBFunctionSelect, TDBFunctionInsert } from '@TDB/types'

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
  model = (data: TDBFunctionSelect) => new FunctionModel(data)
}

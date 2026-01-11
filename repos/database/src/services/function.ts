import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBFunctionSelect, TDBFunctionInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { functions } from '@TDB/schemas/functions'
import { Function as FunctionModel } from '@tdsk/domain'

export type TFunctionOpts = {
  db: NodePgDatabase
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
  #convert = (data: TDBFunctionSelect) => new FunctionModel(data)
}

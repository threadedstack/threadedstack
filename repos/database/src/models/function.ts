import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBFunctionSelect, TDBFunctionInsert } from '@TDB/types'

import { Base } from '@TDB/models/base'
import { functions } from '@TDB/schemas/functions' 

export type TFunctionOpts = {
  db: NodePgDatabase
}

export class Function extends Base<
  typeof functions,
  TDBFunctionSelect,
  TDBFunctionInsert
> {

  constructor(opts: TFunctionOpts) {
    super({...opts, schema: functions})
  }

}

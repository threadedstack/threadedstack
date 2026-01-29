import type { TDatabase, TDBConfigSelect, TDBConfigInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { configs } from '@TDB/schemas/configs'
import { Config as ConfigModel } from '@tdsk/domain'

export type TConfigOpts = {
  db: TDatabase
}

export class Config extends Base<
  typeof configs,
  TDBConfigSelect,
  TDBConfigInsert,
  ConfigModel
> {
  constructor(opts: TConfigOpts) {
    super({ ...opts, table: configs })
  }
  model = (data: TDBConfigSelect) => new ConfigModel(data)
}

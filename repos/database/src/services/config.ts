import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBConfigSelect, TDBConfigInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { configs } from '@TDB/schemas/configs'

export type TConfigOpts = {
  db: NodePgDatabase
}

export class Config extends Base<typeof configs, TDBConfigSelect, TDBConfigInsert> {
  constructor(opts: TConfigOpts) {
    super({ ...opts, table: configs })
  }
}

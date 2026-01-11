import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBAssetSelect, TDBAssetInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { assets } from '@TDB/schemas/assets'

export type TAssetOpts = {
  db: NodePgDatabase
}

export class Asset extends Base<typeof assets, TDBAssetSelect, TDBAssetInsert> {
  constructor(opts: TAssetOpts) {
    super({ ...opts, table: assets })
  }
  model = (data: TDBAssetSelect) => data
}

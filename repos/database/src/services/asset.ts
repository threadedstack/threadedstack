import type { TDatabase, TDBAssetSelect, TDBAssetInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { assets } from '@TDB/schemas/assets'
import { Asset as AssetModel } from '@tdsk/domain'

export type TAssetOpts = {
  db: TDatabase
}

export class Asset extends Base<typeof assets, TDBAssetSelect, TDBAssetInsert> {
  constructor(opts: TAssetOpts) {
    super({ ...opts, table: assets })
  }
  model = (data: TDBAssetSelect) => new AssetModel(data)
}

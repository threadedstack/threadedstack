import type { TServiceOpts, TDBAssetSelect, TDBAssetInsert, TDBApiRes } from '@TDB/types'

import { eq } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { assets } from '@TDB/schemas/assets'
import { Asset as AssetModel } from '@tdsk/domain'

export class Asset extends Base<typeof assets, TDBAssetSelect, TDBAssetInsert> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: assets })
  }
  model = (data: TDBAssetSelect) => new AssetModel(data)

  async listByThread(threadId: string): Promise<TDBApiRes<AssetModel[]>> {
    try {
      const found = await this.db.query.assets.findMany({
        where: eq(assets.threadId, threadId),
      })
      return { data: found.map((row) => this.model(row)) }
    } catch (error: any) {
      return { error }
    }
  }

  async listByMessage(messageId: string): Promise<TDBApiRes<AssetModel[]>> {
    try {
      const found = await this.db.query.assets.findMany({
        where: eq(assets.messageId, messageId),
      })
      return { data: found.map((row) => this.model(row)) }
    } catch (error: any) {
      return { error }
    }
  }
}

import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBApiKeySelect, TDBApiKeyInsert } from '@TDB/types'

import { eq } from 'drizzle-orm'
import { Base } from '@TDB/services/base'
import { apiKeys } from '@TDB/schemas/apiKeys'
import { ApiKey as ApiKeyModel } from '@tdsk/domain'

export type TApiKeyOpts = {
  db: NodePgDatabase
}

export class ApiKey extends Base<
  typeof apiKeys,
  TDBApiKeySelect,
  TDBApiKeyInsert,
  ApiKeyModel
> {
  constructor(opts: TApiKeyOpts) {
    super({ ...opts, table: apiKeys })
  }

  model = (data: TDBApiKeySelect) => new ApiKeyModel(data)

  /**
   * Find an API key by its hash (for authentication)
   */
  getByHash = async (keyHash: string) => {
    try {
      const resp = await this.db
        .select()
        .from(apiKeys)
        .where(eq(apiKeys.keyHash, keyHash))

      if (!resp[0]) return { data: undefined }

      return { data: this.model(resp[0]) }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Update the lastUsedAt timestamp for a key
   */
  touchLastUsed = async (id: string) => {
    try {
      await this.db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, id))

      return { data: true }
    } catch (error: any) {
      return { error }
    }
  }

  /**
   * Revoke an API key (soft delete by setting active to false)
   */
  revoke = async (id: string) => {
    try {
      const resp = await this.db
        .update(apiKeys)
        .set({ active: false })
        .where(eq(apiKeys.id, id))
        .returning()

      return { data: this.model(resp[0]) }
    } catch (error: any) {
      return { error }
    }
  }
}

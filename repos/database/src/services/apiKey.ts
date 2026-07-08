import type {
  TServiceOpts,
  TDBQueryOpts,
  TDBApiKeySelect,
  TDBApiKeyInsert,
} from '@TDB/types'

import { Base } from '@TDB/services/base'
import { apiKeys } from '@TDB/schemas/apiKeys'
import { ApiKey as ApiKeyModel } from '@tdsk/domain'
import { eq, and, like, lt, count } from 'drizzle-orm'

export class ApiKey extends Base<
  typeof apiKeys,
  TDBApiKeySelect,
  TDBApiKeyInsert,
  ApiKeyModel
> {
  constructor(opts: TServiceOpts) {
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
   * List the ACTIVE resident-bound keys for an agent. Used by
   * mintResidentToken to rotate: any key returned here is revoked before a
   * fresh resident key is created.
   */
  getByResidentAgent = async (agentId: string) => {
    try {
      const resp = await this.db
        .select()
        .from(apiKeys)
        .where(and(eq(apiKeys.residentAgentId, agentId), eq(apiKeys.active, true)))

      return { data: resp.map((row) => this.model(row)) }
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
   * List API keys scoped to a specific project
   */
  listByProject = async (projectId: string, opts: TDBQueryOpts = {}) => {
    return this.list({
      ...opts,
      where: { ...opts.where, projectId },
    })
  }

  /**
   * List API keys scoped to an organization.
   * Project-scoped keys are excluded because they have orgId=null (application-level exclusive arc).
   */
  listByOrg = async (orgId: string, opts: TDBQueryOpts = {}) => {
    return this.list({
      ...opts,
      where: { ...opts.where, orgId },
    })
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

  cleanupExpiredCliSessionKeys = async (
    userId: string,
    orgId: string,
    namePrefix: string
  ) => {
    try {
      await this.db
        .update(apiKeys)
        .set({ active: false })
        .where(
          and(
            eq(apiKeys.userId, userId),
            eq(apiKeys.orgId, orgId),
            eq(apiKeys.active, true),
            like(apiKeys.name, `${namePrefix}%`),
            lt(apiKeys.expiresAt, new Date())
          )
        )
      return { data: true }
    } catch (error: any) {
      return { error }
    }
  }

  countActiveCliSessionKeys = async (
    userId: string,
    orgId: string,
    namePrefix: string
  ) => {
    try {
      const resp = await this.db
        .select({ count: count() })
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.userId, userId),
            eq(apiKeys.orgId, orgId),
            eq(apiKeys.active, true),
            like(apiKeys.name, `${namePrefix}%`)
          )
        )
      return { data: Number(resp[0]?.count ?? 0) }
    } catch (error: any) {
      return { error }
    }
  }

  findOldestCliSessionKey = async (userId: string, orgId: string, namePrefix: string) => {
    try {
      const resp = await this.db
        .select()
        .from(apiKeys)
        .where(
          and(
            eq(apiKeys.userId, userId),
            eq(apiKeys.orgId, orgId),
            eq(apiKeys.active, true),
            like(apiKeys.name, `${namePrefix}%`)
          )
        )
        .orderBy(apiKeys.createdAt)
        .limit(1)

      if (!resp[0]) return { data: undefined }
      return { data: this.model(resp[0]) }
    } catch (error: any) {
      return { error }
    }
  }
}

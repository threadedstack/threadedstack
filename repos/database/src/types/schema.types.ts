import type { orgs } from '@TDB/schemas/orgs'
import type { users } from '@TDB/schemas/users'
import type { roles } from '@TDB/schemas/roles'
import type { assets } from '@TDB/schemas/assets'
import type { quotas } from '@TDB/schemas/quotas'
import type { apiKeys } from '@TDB/schemas/apiKeys'
import type { configs } from '@TDB/schemas/configs'
import type { secrets } from '@TDB/schemas/secrets'
import type { threads } from '@TDB/schemas/threads'
import type { messages } from '@TDB/schemas/messages'
import type { projects } from '@TDB/schemas/projects'
import type { endpoints } from '@TDB/schemas/endpoints'
import type { functions } from '@TDB/schemas/functions'
import type { providers } from '@TDB/schemas/providers'
import type { subscriptions } from '@TDB/schemas/subscriptions'
import type { PgTableWithColumns } from 'drizzle-orm/pg-core'
import type { TAnyObj, TKeyLike, Base as BaseModel } from '@tdsk/domain'

type TInferDateProps<T extends TAnyObj = TAnyObj, D extends TKeyLike = TKeyLike> = Omit<
  T,
  D
> & {
  [K in D]?: string | Date
}

type TInferDates<T extends TAnyObj = TAnyObj> = TInferDateProps<
  T,
  `createdAt` | `updatedAt`
>

export type TDBOrgSelect = TInferDates<typeof orgs.$inferSelect>
export type TDBOrgInsert = TInferDates<typeof orgs.$inferInsert>
export type TDBUserSelect = TInferDates<typeof users.$inferSelect>
export type TDBUserInsert = TInferDates<typeof users.$inferInsert>
export type TDBRoleSelect = TInferDates<typeof roles.$inferSelect>
export type TDBRoleInsert = TInferDates<typeof roles.$inferInsert>
export type TDBQuotaSelect = TInferDates<typeof quotas.$inferSelect>
export type TDBQuotaInsert = TInferDates<typeof quotas.$inferInsert>
export type TDBAssetSelect = TInferDates<typeof assets.$inferSelect>
export type TDBAssetInsert = TInferDates<typeof assets.$inferInsert>
export type TDBConfigSelect = TInferDates<typeof configs.$inferSelect>
export type TDBConfigInsert = TInferDates<typeof configs.$inferInsert>
export type TDBSecretSelect = TInferDates<typeof secrets.$inferSelect>
export type TDBSecretInsert = TInferDates<typeof secrets.$inferInsert>
export type TDBThreadSelect = TInferDates<typeof threads.$inferSelect>
export type TDBThreadInsert = TInferDates<typeof threads.$inferInsert>
export type TDBProjectSelect = TInferDates<typeof projects.$inferSelect>
export type TDBProjectInsert = TInferDates<typeof projects.$inferInsert>
export type TDBMessageSelect = TInferDates<typeof messages.$inferSelect>
export type TDBMessageInsert = TInferDates<typeof messages.$inferInsert>
export type TDBEndpointSelect = TInferDates<typeof endpoints.$inferSelect>
export type TDBEndpointInsert = TInferDates<typeof endpoints.$inferInsert>
export type TDBProviderSelect = TInferDates<typeof providers.$inferSelect>
export type TDBProviderInsert = TInferDates<typeof providers.$inferInsert>
export type TDBFunctionSelect = TInferDates<typeof functions.$inferSelect>
export type TDBFunctionInsert = TInferDates<typeof functions.$inferInsert>
export type TDBSubscriptionSelect = TInferDates<typeof subscriptions.$inferSelect>
export type TDBSubscriptionInsert = TInferDates<typeof subscriptions.$inferInsert>

export type TDBApiKeySelect = TInferDateProps<
  typeof apiKeys.$inferSelect,
  `createdAt` | `updatedAt` | `expiresAt` | `lastUsedAt`
>

export type TDBApiKeyInsert = Partial<
  TInferDateProps<
    typeof apiKeys.$inferInsert,
    `createdAt` | `updatedAt` | `expiresAt` | `lastUsedAt`
  >
>

export type TDBEntitySelect =
  | TDBOrgSelect
  | TDBUserSelect
  | TDBRoleSelect
  | TDBAssetSelect
  | TDBQuotaSelect
  | TDBApiKeySelect
  | TDBConfigSelect
  | TDBSecretSelect
  | TDBThreadSelect
  | TDBProjectSelect
  | TDBMessageSelect
  | TDBEndpointSelect
  | TDBProviderSelect
  | TDBFunctionSelect
  | TDBSubscriptionSelect

export type TDBEntityInsert =
  | TDBOrgInsert
  | TDBUserInsert
  | TDBRoleInsert
  | TDBAssetInsert
  | TDBQuotaInsert
  | TDBApiKeyInsert
  | TDBConfigInsert
  | TDBSecretInsert
  | TDBThreadInsert
  | TDBProjectInsert
  | TDBMessageInsert
  | TDBEndpointInsert
  | TDBProviderInsert
  | TDBFunctionInsert
  | TDBSubscriptionInsert

type TTableWithId = {
  id: any
}

export type TTableSchema = PgTableWithColumns<any> & TTableWithId

export type TDBOrderDirection = 'asc' | 'desc'

export type TDBQueryOpts<T extends Record<string, any> = Record<string, any>> = {
  /**
   * Where clause conditions
   * - Single value: exact match (uses eq)
   * - Array of values: match any (uses inArray)
   * - undefined/null: no filter for that field
   */
  where?: {
    [K in keyof T]?: T[K] | T[K][] | null
  }
  limit?: number
  offset?: number
  orderBy?: {
    column: string
    direction?: TDBOrderDirection
  }
}

export type TDBApiRes<M extends BaseModel | BaseModel[]> = {
  data?: M
  error?: Error
}

export type TDBApiResType<T> = {
  data?: T
  error?: Error
}

export interface IDBApi<M extends BaseModel, I extends TDBEntityInsert> {
  create: (data: I, opts?: TDBQueryOpts) => Promise<TDBApiRes<M>>
  list: (opts?: TDBQueryOpts) => Promise<TDBApiRes<M[]>>
  get: (id: string, opts?: TDBQueryOpts) => Promise<TDBApiRes<M>>
  update: (data: I, opts?: TDBQueryOpts) => Promise<TDBApiRes<M>>
  upsert: (data: I, opts?: TDBQueryOpts) => Promise<TDBApiRes<M>>
  delete: (id: string, opts?: TDBQueryOpts) => Promise<TDBApiRes<M>>
}

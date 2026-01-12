import type { orgs } from '@TDB/schemas/orgs'
import type { users } from '@TDB/schemas/users'
import type { repos } from '@TDB/schemas/repos'
import type { roles } from '@TDB/schemas/roles'
import type { assets } from '@TDB/schemas/assets'
import type { apiKeys } from '@TDB/schemas/apiKeys'
import type { configs } from '@TDB/schemas/configs'
import type { secrets } from '@TDB/schemas/secrets'
import type { threads } from '@TDB/schemas/threads'
import type { messages } from '@TDB/schemas/messages'
import type { endpoints } from '@TDB/schemas/endpoints'
import type { providers } from '@TDB/schemas/providers'
import type { functions } from '@TDB/schemas/functions'
import type { TAnyObj, TKeyLike, Base as BaseModel } from '@tdsk/domain'

type TInferDateProps<T extends TAnyObj = TAnyObj, D extends TKeyLike = TKeyLike> = Omit<
  T,
  D
> & {
  [K in D]: string | Date
}

type TInferDates<T extends TAnyObj = TAnyObj> = TInferDateProps<
  T,
  `createdAt` | `updatedAt`
>

export type TDBOrgSelect = TInferDates<typeof orgs.$inferSelect>
export type TDBOrgInsert = TInferDates<typeof orgs.$inferInsert>
export type TDBUserSelect = TInferDates<typeof users.$inferSelect>
export type TDBUserInsert = TInferDates<typeof users.$inferInsert>
export type TDBRepoSelect = TInferDates<typeof repos.$inferSelect>
export type TDBRepoInsert = TInferDates<typeof repos.$inferInsert>
export type TDBRoleSelect = TInferDates<typeof roles.$inferSelect>
export type TDBRoleInsert = TInferDates<typeof roles.$inferInsert>
export type TDBAssetSelect = TInferDates<typeof assets.$inferSelect>
export type TDBAssetInsert = TInferDates<typeof assets.$inferInsert>
export type TDBConfigSelect = TInferDates<typeof configs.$inferSelect>
export type TDBConfigInsert = TInferDates<typeof configs.$inferInsert>
export type TDBSecretSelect = TInferDates<typeof secrets.$inferSelect>
export type TDBSecretInsert = TInferDates<typeof secrets.$inferInsert>
export type TDBThreadSelect = TInferDates<typeof threads.$inferSelect>
export type TDBThreadInsert = TInferDates<typeof threads.$inferInsert>
export type TDBMessageSelect = TInferDates<typeof messages.$inferSelect>
export type TDBMessageInsert = TInferDates<typeof messages.$inferInsert>
export type TDBEndpointSelect = TInferDates<typeof endpoints.$inferSelect>
export type TDBEndpointInsert = TInferDates<typeof endpoints.$inferInsert>
export type TDBProviderSelect = TInferDates<typeof providers.$inferSelect>
export type TDBProviderInsert = TInferDates<typeof providers.$inferInsert>
export type TDBFunctionSelect = TInferDates<typeof functions.$inferSelect>
export type TDBFunctionInsert = TInferDates<typeof functions.$inferInsert>

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
  | TDBUserSelect
  | TDBOrgSelect
  | TDBRepoSelect
  | TDBRoleSelect
  | TDBAssetSelect
  | TDBApiKeySelect
  | TDBConfigSelect
  | TDBSecretSelect
  | TDBThreadSelect
  | TDBMessageSelect
  | TDBEndpointSelect
  | TDBProviderSelect
  | TDBFunctionSelect

export type TDBEntityInsert =
  | TDBUserInsert
  | TDBOrgInsert
  | TDBRepoInsert
  | TDBRoleInsert
  | TDBAssetInsert
  | TDBApiKeyInsert
  | TDBConfigInsert
  | TDBSecretInsert
  | TDBThreadInsert
  | TDBMessageInsert
  | TDBEndpointInsert
  | TDBProviderInsert
  | TDBFunctionInsert

export type TDBSelectOpts = {
  [key: string]: any
}

export type TDBApiRes<M extends BaseModel | BaseModel[]> = {
  data?: M
  error?: Error
}

export interface IDBApi<M extends BaseModel, I extends TDBEntityInsert> {
  create: (data: I, opts: TDBSelectOpts) => Promise<TDBApiRes<M>>
  list: (opts: TDBSelectOpts) => Promise<TDBApiRes<M[]>>
  get: (id: string, opts: TDBSelectOpts) => Promise<TDBApiRes<M>>
  update: (data: I, opts: TDBSelectOpts) => Promise<TDBApiRes<M>>
  upsert: (data: I, opts: TDBSelectOpts) => Promise<TDBApiRes<M>>
  delete: (id: string, opts: TDBSelectOpts) => Promise<TDBApiRes<M>>
}

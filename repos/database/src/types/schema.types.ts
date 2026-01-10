import type { auth } from '@TDB/schemas/auth'
import type { users } from '@TDB/schemas/users'
import type { teams } from '@TDB/schemas/teams'
import type { repos } from '@TDB/schemas/repos'
import type { roles } from '@TDB/schemas/roles'
import type { assets } from '@TDB/schemas/assets'
import type { configs } from '@TDB/schemas/configs'
import type { secrets } from '@TDB/schemas/secrets'
import type { threads } from '@TDB/schemas/threads'
import type { messages } from '@TDB/schemas/messages'
import type { endpoints } from '@TDB/schemas/endpoints'
import type { providers } from '@TDB/schemas/providers'
import type { functions } from '@TDB/schemas/functions'

export type TDBAuthSelect = typeof auth.$inferSelect
export type TDBAuthInsert = typeof auth.$inferInsert
export type TDBUserSelect = typeof users.$inferSelect
export type TDBUserInsert = typeof users.$inferInsert
export type TDBTeamSelect = typeof teams.$inferSelect
export type TDBTeamInsert = typeof teams.$inferInsert
export type TDBRepoSelect = typeof repos.$inferSelect
export type TDBRepoInsert = typeof repos.$inferInsert
export type TDBRoleSelect = typeof roles.$inferSelect
export type TDBRoleInsert = typeof roles.$inferInsert
export type TDBAssetSelect = typeof assets.$inferSelect
export type TDBAssetInsert = typeof assets.$inferInsert
export type TDBConfigSelect = typeof configs.$inferSelect
export type TDBConfigInsert = typeof configs.$inferInsert
export type TDBSecretSelect = typeof secrets.$inferSelect
export type TDBSecretInsert = typeof secrets.$inferInsert
export type TDBThreadSelect = typeof threads.$inferSelect
export type TDBThreadInsert = typeof threads.$inferInsert
export type TDBMessageSelect = typeof messages.$inferSelect
export type TDBMessageInsert = typeof messages.$inferInsert
export type TDBEndpointSelect = typeof endpoints.$inferSelect
export type TDBEndpointInsert = typeof endpoints.$inferInsert
export type TDBProviderSelect = typeof providers.$inferSelect
export type TDBProviderInsert = typeof providers.$inferInsert
export type TDBFunctionSelect = typeof functions.$inferSelect
export type TDBFunctionInsert = typeof functions.$inferInsert

export type TDBEntitySelect =
  | TDBAuthSelect
  | TDBUserSelect
  | TDBTeamSelect
  | TDBRepoSelect
  | TDBRoleSelect
  | TDBAssetSelect
  | TDBConfigSelect
  | TDBSecretSelect
  | TDBThreadSelect
  | TDBMessageSelect
  | TDBEndpointSelect
  | TDBProviderSelect
  | TDBFunctionSelect

export type TDBEntityInsert =
  | TDBAuthInsert
  | TDBUserInsert
  | TDBTeamInsert
  | TDBRepoInsert
  | TDBRoleInsert
  | TDBAssetInsert
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

export type TDBApiRes<S extends TDBEntitySelect | TDBEntitySelect[]> = {
  data?: S
  error?: Error
}

export interface IDBApi<S extends TDBEntitySelect, I extends TDBEntityInsert> {
  create: (data: I, opts: TDBSelectOpts) => Promise<TDBApiRes<S>>
  list: (opts: TDBSelectOpts) => Promise<TDBApiRes<S[]>>
  get: (id: string, opts: TDBSelectOpts) => Promise<TDBApiRes<S>>
  update: (data: I, opts: TDBSelectOpts) => Promise<TDBApiRes<S>>
  upsert: (data: I, opts: TDBSelectOpts) => Promise<TDBApiRes<S>>
  delete: (id: string, opts: TDBSelectOpts) => Promise<TDBApiRes<S>>
}

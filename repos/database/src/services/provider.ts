import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBProviderSelect, TDBProviderInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { providers } from '@TDB/schemas/providers'

export type TProviderOpts = {
  db: NodePgDatabase
}

export class Provider extends Base<
  typeof providers,
  TDBProviderSelect,
  TDBProviderInsert
> {
  constructor(opts: TProviderOpts) {
    super({ ...opts, table: providers })
  }
}

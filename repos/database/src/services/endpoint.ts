import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBEndpointSelect, TDBEndpointInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { endpoints } from '@TDB/schemas/endpoints'

export type TEndpointOpts = {
  db: NodePgDatabase
}

export class Endpoint extends Base<
  typeof endpoints,
  TDBEndpointSelect,
  TDBEndpointInsert
> {
  constructor(opts: TEndpointOpts) {
    super({ ...opts, table: endpoints })
  }
}

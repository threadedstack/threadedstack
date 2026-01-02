import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBSecretSelect, TDBSecretInsert } from '@TDB/types'

import { Base } from '@TDB/models/base'
import { secrets } from '@TDB/schemas/secrets' 

export type TSecretOpts = {
  db: NodePgDatabase
}

export class Secret extends Base<
  typeof secrets,
  TDBSecretSelect,
  TDBSecretInsert
> {

  constructor(opts: TSecretOpts) {
    super({...opts, schema: secrets})
  }

}

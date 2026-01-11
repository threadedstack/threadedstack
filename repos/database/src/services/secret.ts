import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type { TDBSecretSelect, TDBSecretInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { secrets } from '@TDB/schemas/secrets'
import { Secret as SecretModel } from '@tdsk/domain'

export type TSecretOpts = {
  db: NodePgDatabase
}

export class Secret extends Base<
  typeof secrets,
  TDBSecretSelect,
  TDBSecretInsert,
  SecretModel
> {
  constructor(opts: TSecretOpts) {
    super({ ...opts, table: secrets })
  }

  model = (data: TDBSecretSelect) => new SecretModel(data)
}

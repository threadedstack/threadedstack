import type { TServiceOpts, TDBSecretSelect, TDBSecretInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { secrets } from '@TDB/schemas/secrets'
import { Secret as SecretModel } from '@tdsk/domain'

export class Secret extends Base<
  typeof secrets,
  TDBSecretSelect,
  TDBSecretInsert,
  SecretModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: secrets })
  }

  model = (data: TDBSecretSelect) => new SecretModel(data)
}

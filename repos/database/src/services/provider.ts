import type { TDatabase, TDBProviderSelect, TDBProviderInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { providers } from '@TDB/schemas/providers'
import { Provider as ProviderModel } from '@tdsk/domain'

export type TProviderOpts = {
  db: TDatabase
}

export class Provider extends Base<
  typeof providers,
  TDBProviderSelect,
  TDBProviderInsert,
  ProviderModel
> {
  constructor(opts: TProviderOpts) {
    super({ ...opts, table: providers })
  }
  model = (data: TDBProviderSelect) => {
    return new ProviderModel(data as Partial<ProviderModel>)
  }
}

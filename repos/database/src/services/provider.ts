import type { TServiceOpts, TDBProviderSelect, TDBProviderInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { providers } from '@TDB/schemas/providers'
import { Provider as ProviderModel } from '@tdsk/domain'

export class Provider extends Base<
  typeof providers,
  TDBProviderSelect,
  TDBProviderInsert,
  ProviderModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: providers })
  }
  model = (data: TDBProviderSelect) => {
    return new ProviderModel(data as Partial<ProviderModel>)
  }
}

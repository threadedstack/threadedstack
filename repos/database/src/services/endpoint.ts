import type { TServiceOpts, TDBEndpointSelect, TDBEndpointInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { endpoints } from '@TDB/schemas/endpoints'
import { Endpoint as EndpointModel } from '@tdsk/domain'

export class Endpoint extends Base<
  typeof endpoints,
  TDBEndpointSelect,
  TDBEndpointInsert,
  EndpointModel
> {
  constructor(opts: TServiceOpts) {
    super({ ...opts, table: endpoints })
  }
  model = (data: TDBEndpointSelect) => {
    return new EndpointModel(data as Partial<EndpointModel>)
  }
}

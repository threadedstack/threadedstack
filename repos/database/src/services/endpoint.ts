import type { TDatabase, TDBEndpointSelect, TDBEndpointInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { endpoints } from '@TDB/schemas/endpoints'
import { Endpoint as EndpointModel } from '@tdsk/domain'

export type TEndpointOpts = {
  db: TDatabase
}

export class Endpoint extends Base<
  typeof endpoints,
  TDBEndpointSelect,
  TDBEndpointInsert,
  EndpointModel
> {
  constructor(opts: TEndpointOpts) {
    super({ ...opts, table: endpoints })
  }
  model = (data: TDBEndpointSelect) => {
    return new EndpointModel(data as Partial<EndpointModel>)
  }
}

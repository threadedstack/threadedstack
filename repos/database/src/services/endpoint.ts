import type { TEndpointType } from '@tdsk/domain'
import type { TServiceOpts, TDBEndpointSelect, TDBEndpointInsert } from '@TDB/types'

import { Base } from '@TDB/services/base'
import { endpoints } from '@TDB/schemas/endpoints'
import { Endpoint as EndpointModel } from '@tdsk/domain'

type TEndpointData = Omit<Partial<EndpointModel<TEndpointType>>, `type`> & {
  type: EndpointModel[`type`]
}

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
    return new EndpointModel(data as TEndpointData)
  }
}

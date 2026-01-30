import type { TEndpointOpts, TEndpointType } from '@TDM/types'

import { Base } from './base'

type TEPOpts<T extends TEndpointType> = Omit<Partial<Endpoint<T>>, `type`> & {
  type: TEndpointType
}

export class Endpoint<T extends TEndpointType = TEndpointType> extends Base {
  type: T
  url: string
  name: string
  path: string
  projectId: string
  method: string = `GET`
  public?: boolean = false
  options: TEndpointOpts<T>
  headers: Record<string, string>

  constructor(endpoint: TEPOpts<T>) {
    super()
    Object.assign(this, endpoint)
  }
}

import type { TEndpointOpts, TEndpointType, EEndpointType } from '@TDM/types'

import { Base } from './base'

type TEPOpts<T extends TEndpointType> = Omit<Partial<Endpoint<T>>, `type`> & {
  type: TEndpointType
}

export class Endpoint<T extends TEndpointType = TEndpointType> extends Base {
  type: T
  path: string
  name?: string
  projectId: string
  method: string = `GET`
  public?: boolean = false
  options?: TEndpointOpts<T>
  headers?: Record<string, string>

  constructor(endpoint: TEPOpts<T>) {
    super()
    Object.assign(this, endpoint)
  }
}

export class ProxyEndpoint extends Endpoint<EEndpointType.proxy> {
  declare type: EEndpointType.proxy

  constructor(endpoint: TEPOpts<EEndpointType.proxy>) {
    super(endpoint)
  }
}

export class FaaSEndpoint extends Endpoint<EEndpointType.faas> {
  declare type: EEndpointType.faas

  constructor(endpoint: TEPOpts<EEndpointType.faas>) {
    super(endpoint)
  }
}

export class AgentEndpoint extends Endpoint<EEndpointType.agent> {
  declare type: EEndpointType.agent

  constructor(endpoint: TEPOpts<EEndpointType.agent>) {
    super(endpoint)
  }
}

import type { TEndpointOpts } from '@TDM/types'

import { Base } from './base'

export class Endpoint extends Base {
  url: string
  name: string
  path: string
  projectId: string
  method: string = `GET`
  options: TEndpointOpts
  public?: boolean = false
  headers: Record<string, string>

  constructor(endpoint: Partial<Endpoint>) {
    super()
    Object.assign(this, endpoint)
  }
}

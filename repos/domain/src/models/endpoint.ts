import { Base } from './base'

export class Endpoint extends Base {
  repoId: string
  proxyUrl?: string
  proxyMethod: string = 'GET'
  proxyHeaders?: Record<string, any>
  proxyOptions?: Record<string, any>
  public: boolean = false

  constructor(endpoint: Partial<Endpoint>) {
    super()
    Object.assign(this, endpoint)
  }
}

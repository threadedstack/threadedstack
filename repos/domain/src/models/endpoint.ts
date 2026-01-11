import { Base } from './base'

export class Endpoint extends Base {
  url: string
  name: string
  repoId: string
  method: string = `GET`
  public?: boolean = false
  options: Record<string, any>
  headers: Record<string, string>

  constructor(endpoint: Partial<Endpoint>) {
    super()
    Object.assign(this, endpoint)
  }
}

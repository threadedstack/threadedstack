import { Base } from './base'

export class Endpoint extends Base {
  url: string
  name: string
  repoId: string
  public?: boolean
  method: string = `GET`
  headers: Record<string, string>
  options: Record<string, any>

  constructor(endpoint: Partial<Endpoint>) {
    super()
    Object.assign(this, endpoint)
  }
}

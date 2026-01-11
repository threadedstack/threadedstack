import { Base } from './base'

export class Config extends Base {
  userId?: string
  orgId?: string
  repoId?: string
  data: Record<string, any>

  constructor(endpoint: Partial<Config>) {
    super()
    Object.assign(this, endpoint)
  }
}

import { Base } from './base'

export class Config extends Base {
  userId?: string
  orgId?: string
  projectId?: string
  data: Record<string, any>

  constructor(config: Partial<Config>) {
    super()
    Object.assign(this, config)
  }
}

import { Base } from '@TDM/models/base'

export class Quota extends Base {
  orgId: string
  period: string
  projects: number = 0
  compute: number = 0
  threads: number = 0
  messages: number = 0
  endpoints: number = 0
  secrets: number = 0

  constructor(quota: Partial<Quota>) {
    super()
    Object.assign(this, quota)
  }
}

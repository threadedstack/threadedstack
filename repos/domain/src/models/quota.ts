import { Base } from './base'

export class Quota extends Base {
  orgId: string
  period: string
  price: number = 0
  members: number = 0
  threads: number = 0
  runtime: number = 0
  projects: number = 0
  messages: number = 0
  retention: number = 0
  endpoints: number = 0
  orgSecrets: number = 0
  functionCalls: number = 0
  organizations: number = 0
  projectSecrets: number = 0

  constructor(quota: Partial<Quota>) {
    super()
    Object.assign(this, quota)
  }
}

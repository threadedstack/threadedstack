import type { TKubeSandboxConfig } from '@TDM/types'

import { Base } from './base'

type TSandboxData = Partial<Sandbox>

export class Sandbox extends Base {
  name: string
  orgId: string
  userId?: string
  projectId?: string
  config: TKubeSandboxConfig

  constructor(data: TSandboxData) {
    super()
    Object.assign(this, data)
  }
}

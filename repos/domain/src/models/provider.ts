import type { TProviderType } from '@TDM/types'

import { Base } from './base'

export class Provider extends Base {
  name?: string
  orgId?: string
  userId?: string
  projectId?: string
  type: TProviderType
  options: Record<string, any> = {}

  constructor(provider: Partial<Provider>) {
    super()
    Object.assign(this, provider)
  }
}

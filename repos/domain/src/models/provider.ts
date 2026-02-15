import type { TProviderType } from '@TDM/types'

import { Base } from './base'

export class Provider extends Base {
  name?: string
  orgId: string
  type: TProviderType
  options: Record<string, any> = {}
  headers?: Record<string, string>

  constructor(provider: Partial<Provider>) {
    super()
    Object.assign(this, provider)
  }
}

import type { TProviderType } from '@TDM/types'

import { Base } from './base'

export class Provider extends Base {
  teamId?: string
  userId?: string
  type: TProviderType
  options: Record<string, any> = {}

  constructor(provider: Partial<Provider>) {
    super()
    Object.assign(this, provider)
  }
}

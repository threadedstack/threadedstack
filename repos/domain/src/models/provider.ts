import type { TProviderType, TProviderBrand } from '@TDM/types'

import { Base } from './base'

export class Provider extends Base {
  name?: string
  orgId: string
  secretId?: string
  type: TProviderType
  brand: TProviderBrand
  options: Record<string, any> = {}
  headers?: Record<string, string>
  bodyParams?: Record<string, any>

  constructor(provider: Partial<Provider>) {
    super()
    Object.assign(this, provider)
  }
}

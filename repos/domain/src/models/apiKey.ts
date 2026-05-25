import type { TPermission } from '@TDM/types'

import { Base } from '@TDM/models/base'
import { omitKeys } from '@keg-hub/jsutils/omitKeys'

export class ApiKey extends Base {
  key?: string
  name: string
  orgId?: string
  userId?: string
  keyHash: string
  active: boolean
  keyPrefix: string
  rateLimit?: number
  projectId?: string
  expiresAt?: Date | string
  lastUsedAt?: Date | string
  permissions?: TPermission[]

  constructor(apiKey: Partial<ApiKey>) {
    super()
    Object.assign(this, apiKey)
  }

  hasPermission(permission: TPermission): boolean {
    if (!this.permissions) return false
    return this.permissions.includes(permission)
  }

  isExpired(): boolean {
    if (!this.expiresAt) return false
    const expiry = new Date(this.expiresAt)
    return expiry < new Date()
  }

  isValid(): boolean {
    return this.active && !this.isExpired()
  }

  getRateLimit(): number {
    return this.rateLimit || 100
  }

  sanitize = () => {
    return new ApiKey(omitKeys(this, [`key`, `keyHash`]))
  }
}

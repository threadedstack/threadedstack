import { Base } from './base'
import type { TApiKeyScope } from '@TDM/types'
import { omitKeys } from '@keg-hub/jsutils/omitKeys'

export class ApiKey extends Base {
  name: string
  orgId?: string
  repoId?: string
  keyHash: string
  scopes?: string
  active: boolean
  keyPrefix: string
  rateLimit?: number
  expiresAt?: Date | string
  lastUsedAt?: Date | string

  constructor(apiKey: Partial<ApiKey>) {
    super()
    Object.assign(this, apiKey)
  }

  hasScope(scope: TApiKeyScope): boolean {
    if (!this.scopes) return false
    const scopeList = this.scopes.split(',').map((s) => s.trim())
    return scopeList.includes(scope) || scopeList.includes('admin')
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
    return this.rateLimit ? this.rateLimit : 100
  }

  sanitize = () => {
    return new ApiKey(omitKeys(this, [`keyHash`]))
  }
}

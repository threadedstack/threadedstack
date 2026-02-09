import type { TInviteStatus } from '@TDM/types'

import { Base } from './base'
import { EInviteStatus } from '@TDM/types'

/**
 * Invitation Model
 *
 * Represents an invitation to join an organization.
 * Supports both existing users (immediate acceptance) and new users (pending).
 */
export class Invitation extends Base {
  email: string
  orgId: string
  token: string
  userId?: string
  roleType: string
  invitedBy?: string
  revokedBy?: string
  revokedAt?: string | Date
  expiresAt: string | Date
  acceptedAt?: string | Date
  status: TInviteStatus | string

  constructor(data: Partial<Invitation>) {
    super()
    Object.assign(this, data)
  }

  /**
   * Create a sanitized copy without the token field
   */
  sanitize() {
    const { token, ...rest } = Object.assign({}, this)
    return new Invitation(rest as Partial<Invitation>)
  }

  /**
   * Check if invitation is still pending
   */
  isPending = (): boolean => {
    return this.status === EInviteStatus.pending && !this.isExpired()
  }

  /**
   * Check if invitation has expired
   */
  isExpired = (): boolean => {
    if (!this.expiresAt) return false
    return new Date(this.expiresAt) < new Date()
  }

  /**
   * Check if invitation has been accepted
   */
  isAccepted = (): boolean => {
    return this.status === EInviteStatus.accepted
  }

  /**
   * Check if invitation has been revoked
   */
  isRevoked = (): boolean => {
    return this.status === EInviteStatus.revoked
  }

  /**
   * Get days until expiration (negative if expired)
   */
  daysUntilExpiration = (): number => {
    if (!this.expiresAt) return 365
    const diff = new Date(this.expiresAt).getTime() - new Date().getTime()
    return Math.ceil(diff / (1000 * 60 * 60 * 24))
  }
}

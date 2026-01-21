/**
 * Organization Invitation Status
 */
export enum EInviteStatus {
  // Invitation sent, awaiting acceptance
  pending = `pending`,
  // User accepted and joined the org
  accepted = `accepted`,
  // Invitation passed expiration date
  expired = `expired`,
  // Admin cancelled the invitation
  revoked = `revoked`,
}

export type TInviteStatus = `${EInviteStatus}`

/**
 * Create invitation request
 */
export type TCreateInvitationInput = {
  email: string
  orgId: string
  roleType: string
  invitedBy: string
  expiresInDays?: number
}

/**
 * Accept invitation request
 */
export type TAcceptInvitationInput = {
  token: string
  userId: string
}

/**
 * Revoke invitation request
 */
export type TRevokeInvitationInput = {
  invitationId: string
  revokedBy: string
}

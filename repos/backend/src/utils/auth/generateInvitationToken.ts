import crypto from 'node:crypto'

/**
 * Generate a secure random invitation token
 * Returns a URL-safe base64 string (32 bytes = 256 bits)
 */
export const generateInvitationToken = (): string => {
  return crypto.randomBytes(32).toString(`base64url`)
}

/**
 * Calculate expiration date for invitation
 * @param days - Number of days until expiration (default: 7)
 */
export const getInvitationExpiration = (days: number = 7): string => {
  const expiresAt = new Date()
  expiresAt.setDate(expiresAt.getDate() + days)
  return expiresAt.toISOString()
}

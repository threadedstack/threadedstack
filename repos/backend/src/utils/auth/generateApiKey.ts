import type { TKeyHash } from '@tdsk/domain'
import crypto from 'crypto'

/**
 * Generates a new API key
 * Generate a cryptographically secure random key
 * Create SHA-256 hash for storage and extract prefix for identification
 * Returns the raw key (only shown once) and its hash for storage
 */
export const generateApiKey = (): TKeyHash => {
  const keyBytes = crypto.randomBytes(32)
  const key = `tdsk_${keyBytes.toString(`base64url`)}`

  const hash = crypto.createHash(`sha256`).update(key).digest(`hex`)

  const prefix = key.substring(0, 12)

  return { key, hash, prefix }
}

/**
 * Hash an API key for comparison
 */
export const hashApiKey = (key: string): string => {
  return crypto.createHash('sha256').update(key).digest('hex')
}

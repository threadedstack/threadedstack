import type { TKeyHash } from '@tdsk/domain'

import crypto from 'crypto'
import { hashKey, ApiKeyPrefix } from '@tdsk/domain'

/**
 * Generates a new API key
 * Generate a cryptographically secure random key
 * Create SHA-256 hash for storage and extract prefix for identification
 * Returns the raw key (only shown once) and its hash for storage
 */
export const generateApiKey = (): TKeyHash => {
  const keyBytes = crypto.randomBytes(32)
  const key = `${ApiKeyPrefix}${keyBytes.toString(`base64url`)}`

  const hash = hashKey(key)

  const prefix = key.substring(0, 12)

  return { key, hash, prefix }
}

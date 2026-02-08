import { createHashKey, encodeEncrypted, deriveKey, encryptValue } from '@tdsk/domain'

/**
 * Helper function to encrypt secret values for seeding
 * This mirrors the pattern used in the backend's createSecret endpoint
 *
 * @param name - The name of the secret (used for hash key)
 * @param value - The plaintext secret value to encrypt
 * @param refId - Reference ID for key derivation (orgId, projectId, or providerId)
 * @returns Object with hashKey and encryptedValue properly formatted
 *
 * @example
 * ```typescript
 * const { hashKey, encryptedValue } = await encryptSecret(
 *   'API Key',
 *   'sk-test-key',
 *   'org-123'
 * )
 * ```
 */
export async function encryptSecret(name: string, value: string, refId: string) {
  const derivedKey = await deriveKey(refId)
  const { iv, encrypted, authTag } = await encryptValue(derivedKey, value)
  const encryptedValue = encodeEncrypted(iv, authTag, encrypted)
  const hashKey = createHashKey(name)

  return { hashKey, encryptedValue }
}

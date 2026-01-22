import type { Secret } from '@tdsk/domain'

/**
 * Pattern to match secret references in format {{secret-name}}
 */
const SECRET_REF_PATTERN = /\{\{([^}]+)\}\}/g

/**
 * Replaces secret references ({{secret-name}}) in a string value with actual secret values
 *
 * @param value - The string that may contain secret references
 * @param secrets - Array of available secrets
 * @returns The string with secret references replaced by actual values
 *
 * @example
 * replaceSecretReferences('Bearer {{API_TOKEN}}', secrets)
 * // Returns: 'Bearer abc123xyz' (if API_TOKEN secret value is 'abc123xyz')
 */
const replaceSecretReferences = (value: string, secrets: Secret[]): string => {
  if (!value || !secrets || secrets.length === 0) {
    return value
  }

  // Create a map of secret names to values for O(1) lookup
  const secretMap = new Map<string, string>()
  secrets.forEach((secret) => {
    const name = secret.name || secret.hashKey
    if (name && secret.value) {
      secretMap.set(name, secret.value)
    }
  })

  // Replace all {{secret-name}} occurrences with actual values
  return value.replace(SECRET_REF_PATTERN, (match, secretName) => {
    const secretValue = secretMap.get(secretName.trim())
    if (!secretValue) {
      // If secret not found, return original reference (could also throw error)
      return match
    }
    return secretValue
  })
}

/**
 * Replaces secret references in all values of a headers object
 *
 * @param headers - Object with header names as keys and values (may contain secret refs)
 * @param secrets - Array of available secrets
 * @returns New headers object with secret references replaced
 *
 * @example
 * replaceSecretsInHeaders(
 *   { 'Authorization': 'Bearer {{API_TOKEN}}', 'X-API-Key': '{{API_KEY}}' },
 *   secrets
 * )
 * // Returns: { 'Authorization': 'Bearer abc123', 'X-API-Key': 'xyz789' }
 */
export const replaceSecretsInHeaders = (
  headers: Record<string, string>,
  secrets: Secret[]
): Record<string, string> => {
  if (!headers || typeof headers !== 'object') {
    return headers
  }

  const result: Record<string, string> = {}

  Object.entries(headers).forEach(([key, value]) => {
    result[key] = replaceSecretReferences(value, secrets)
  })

  return result
}

/**
 * Recursively replaces secret references in any object
 *
 * @param obj - Object that may contain secret references in string values
 * @param secrets - Array of available secrets
 * @returns New object with secret references replaced
 *
 * @example
 * replaceSecretsInObj(
 *   {
 *     tokenUrl: 'https://oauth.example.com/token',
 *     clientId: '{{CLIENT_ID}}',
 *     clientSecret: '{{CLIENT_SECRET}}',
 *     params: { scope: 'read write' }
 *   },
 *   secrets
 * )
 * // Returns object with {{CLIENT_ID}} and {{CLIENT_SECRET}} replaced
 */
export const replaceSecretsInObj = <T extends Record<string, any>>(
  obj: T,
  secrets: Secret[]
): T => {
  if (!obj || typeof obj !== 'object') {
    return obj
  }

  if (Array.isArray(obj)) {
    return obj.map((item) =>
      typeof item === 'string'
        ? replaceSecretReferences(item, secrets)
        : typeof item === 'object'
          ? replaceSecretsInObj(item, secrets)
          : item
    ) as unknown as T
  }

  const result: Record<string, any> = {}

  Object.entries(obj).forEach(([key, value]) => {
    if (typeof value === 'string') {
      result[key] = replaceSecretReferences(value, secrets)
    } else if (typeof value === 'object' && value !== null) {
      result[key] = replaceSecretsInObj(value, secrets)
    } else {
      result[key] = value
    }
  })

  return result as T
}

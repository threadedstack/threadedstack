import type { Secret } from '@tdsk/domain'
import type { TSecretResolverDb } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { isObj } from '@keg-hub/jsutils/isObj'
import { deriveKey, decryptValue, SecretRefTest, SecretRefPattern } from '@tdsk/domain'

type TProvider = {
  id: string
  orgId: string
  headers?: Record<string, string>
  bodyParams?: Record<string, any>
}
type TSecretScope = {
  orgId: string
  providerId: string
}

/**
 * SecretResolver
 *
 * Service for resolving, decrypting, and replacing secret references.
 * Handles {{ name:id }} template substitution, multi-scope decryption,
 * and direct provider.secretId API key resolution.
 */
export class SecretResolver {
  db: TSecretResolverDb

  constructor(db: TSecretResolverDb) {
    this.db = db
  }

  // ── Static: Template Detection & Replacement ────────────────────────

  /**
   * Fast-path check: does any string value contain a {{...}} template?
   */
  static hasSecretRefs = (values: Iterable<string>): boolean => {
    for (const v of values) if (SecretRefTest.test(v)) return true

    return false
  }

  /**
   * Replaces {{ name:id }} references in a string with actual secret values.
   * Resolves by secret ID (the 10-char nanoid after the colon).
   */
  private static replaceRefs = (value: string, secrets: Secret[]): string => {
    if (!value || !secrets || secrets.length === 0) {
      return value
    }

    const idMap = new Map<string, string>()
    for (const secret of secrets) {
      if (secret.id && secret.value) {
        idMap.set(secret.id, secret.value)
      }
    }

    return value.replace(SecretRefPattern, (match, _name: string, id: string) => {
      const resolved = idMap.get(id)
      if (!resolved) {
        logger.warn(`Secret reference not resolved - id: ${id}, template: ${match}`)
      }
      return resolved ?? match
    })
  }

  /**
   * Replaces secret references in all values of a headers object
   */
  static replaceInHeaders = (
    headers: Record<string, string>,
    secrets: Secret[]
  ): Record<string, string> => {
    if (!isObj(headers)) return headers

    return SecretResolver.replaceInObj(headers, secrets)
  }

  /**
   * Recursively replaces secret references in any object
   */
  static replaceInObj = <T extends Record<string, any>>(obj: T, secrets: Secret[]): T => {
    if (!obj || typeof obj !== 'object') {
      return obj
    }

    if (Array.isArray(obj)) {
      return obj.map((item) =>
        typeof item === 'string'
          ? SecretResolver.replaceRefs(item, secrets)
          : typeof item === 'object'
            ? SecretResolver.replaceInObj(item, secrets)
            : item
      ) as unknown as T
    }

    const result: Record<string, any> = {}
    Object.entries(obj).forEach(([key, value]) => {
      if (typeof value === 'string') {
        result[key] = SecretResolver.replaceRefs(value, secrets)
      } else if (typeof value === 'object' && value !== null) {
        result[key] = SecretResolver.replaceInObj(value, secrets)
      } else {
        result[key] = value
      }
    })
    return result as T
  }

  // ── Instance: Decryption & Resolution ───────────────────────────────

  /**
   * Decrypt a secret's encryptedValue using the appropriate scope owner ID.
   * Falls back to orgId if decryption with the owner ID fails (handles
   * quickstart secrets that were encrypted with orgId but stored as provider-scoped).
   */
  decrypt = async (
    secret: {
      orgId?: string
      agentId?: string
      projectId?: string
      providerId?: string
      encryptedValue: string
    },
    orgId: string
  ): Promise<string | null> => {
    if (!secret.encryptedValue) return null

    const combined = Buffer.from(secret.encryptedValue, `base64`)
    if (combined.length < 29) return null // 12 (iv) + 16 (authTag) + 1 (min ciphertext)

    const iv = combined.subarray(0, 12)
    const authTag = combined.subarray(12, 28)
    const ciphertext = combined.subarray(28)

    // Determine the scope owner for key derivation
    const refId = secret.agentId || secret.providerId || secret.projectId || secret.orgId

    // Try the scope owner first
    if (refId) {
      try {
        const key = await deriveKey(refId)
        return await decryptValue(key, ciphertext, iv, authTag)
      } catch {
        logger.debug(`Decryption failed with scope owner, trying orgId fallback`, {
          refId,
        })
      }
    }

    // Fallback: try orgId (handles quickstart encryption mismatch)
    if (orgId && orgId !== refId) {
      try {
        const key = await deriveKey(orgId)
        return await decryptValue(key, ciphertext, iv, authTag)
      } catch {
        logger.debug(`Decryption failed with orgId fallback`, { orgId })
      }
    }

    logger.warn(`Secret decryption failed: all attempts exhausted`, { refId, orgId })
    return null
  }

  /**
   * Resolve an API key via provider.secretId (direct O(1) lookup only).
   * Returns empty string if no secretId set or decryption fails.
   * Callers handle empty string by throwing 400.
   */
  resolveApiKey = async (
    agent: { orgId: string },
    provider: { id: string; secretId?: string }
  ): Promise<string> => {
    if (!provider.secretId) return ``

    const { data: secret, error: secretErr } = await this.db.services.secret.get(
      provider.secretId
    )
    if (secretErr)
      logger.error(
        `[SecretResolver] Failed to fetch secret ${provider.secretId}:`,
        secretErr.message
      )
    if (!secret?.encryptedValue) return ``

    const value = await this.decrypt(secret, agent.orgId)
    return value || ``
  }

  /**
   * Loads provider-scoped + org-scoped secrets, deduplicates, and decrypts them.
   * Provider-scoped secrets take precedence over org-scoped when names collide.
   */
  loadAndDecrypt = async (scope: TSecretScope): Promise<Secret[]> => {
    const { data: providerSecrets, error: provSecretErr } =
      await this.db.services.secret.list({
        where: { providerId: scope.providerId },
      })
    if (provSecretErr)
      logger.error(
        `[SecretResolver] Failed to list provider secrets for ${scope.providerId}:`,
        provSecretErr.message
      )
    const { data: orgSecrets, error: orgSecretErr } = await this.db.services.secret.list({
      where: { orgId: scope.orgId },
    })
    if (orgSecretErr)
      logger.error(
        `[SecretResolver] Failed to list org secrets for ${scope.orgId}:`,
        orgSecretErr.message
      )

    const decrypted: Secret[] = []
    const allSecrets = [...(providerSecrets || []), ...(orgSecrets || [])]
    const seen = new Set<string>()

    for (const secret of allSecrets) {
      if (seen.has(secret.id)) continue
      seen.add(secret.id)

      const value = await this.decrypt(secret, scope.orgId)
      if (value) {
        decrypted.push({ ...secret, value } as Secret)
      }
    }

    return decrypted
  }

  /**
   * Resolves {{ name:id }} templates in provider.bodyParams using decrypted secrets.
   *
   * Unlike resolveHeaders, bodyParams values can be non-strings (numbers, booleans, objects),
   * so only string values are checked for {{...}} templates. Non-string values pass through.
   */
  resolveBodyParams = async (
    provider: TProvider
  ): Promise<Record<string, unknown> | undefined> => {
    if (!provider.bodyParams || Object.keys(provider.bodyParams).length === 0)
      return undefined

    // Only check string values for template references
    const stringValues = Object.values(provider.bodyParams).filter(
      (v): v is string => typeof v === 'string'
    )
    if (stringValues.length === 0 || !SecretResolver.hasSecretRefs(stringValues))
      return provider.bodyParams

    const decrypted = await this.loadAndDecrypt({
      providerId: provider.id,
      orgId: provider.orgId,
    })

    return SecretResolver.replaceInObj(provider.bodyParams, decrypted)
  }

  /**
   * Resolves {{ name:id }} templates in provider.headers using decrypted secrets.
   *
   * 1. If headers is empty/undefined → returns undefined
   * 2. If no {{...}} patterns found → returns headers as-is (no DB queries)
   * 3. Otherwise → loads provider-scoped secrets (falls back to org-scoped),
   *    decrypts each, and replaces template references
   */
  resolveHeaders = async (
    provider: TProvider
  ): Promise<Record<string, string> | undefined> => {
    if (!provider.headers || Object.keys(provider.headers).length === 0) return undefined

    // Fast path: no template references, return as-is
    if (!SecretResolver.hasSecretRefs(Object.values(provider.headers)))
      return provider.headers

    const decrypted = await this.loadAndDecrypt({
      providerId: provider.id,
      orgId: provider.orgId,
    })

    return SecretResolver.replaceInHeaders(provider.headers, decrypted)
  }
}

import type { Secret } from '@tdsk/domain'
import { deriveKey, decryptValue } from '@tdsk/domain'

const SECRET_REF_PATTERN = /\{\{([^}]+)\}\}/g
const SECRET_REF_TEST = /\{\{([^}]+)\}\}/

export type TSecretResolverDb = {
  services: {
    secret: {
      list: (opts: any) => Promise<{ data?: any[] }>
    }
  }
}

/**
 * SecretResolver
 *
 * Service for resolving, decrypting, and replacing secret references.
 * Handles {{SECRET_NAME}} template substitution, multi-scope decryption,
 * and 3-tier API key resolution.
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
    for (const v of values) {
      if (SECRET_REF_TEST.test(v)) return true
    }
    return false
  }

  /**
   * Replaces {{secret-name}} references in a string with actual secret values
   */
  private static replaceRefs = (value: string, secrets: Secret[]): string => {
    if (!value || !secrets || secrets.length === 0) {
      return value
    }

    const secretMap = new Map<string, string>()
    secrets.forEach((secret) => {
      const name = secret.name || secret.hashKey
      if (name && secret.value) {
        secretMap.set(name, secret.value)
      }
    })

    return value.replace(SECRET_REF_PATTERN, (match, secretName) => {
      const secretValue = secretMap.get(secretName.trim())
      return secretValue ?? match
    })
  }

  /**
   * Replaces secret references in all values of a headers object
   */
  static replaceInHeaders = (
    headers: Record<string, string>,
    secrets: Secret[]
  ): Record<string, string> => {
    if (!headers || typeof headers !== 'object') {
      return headers
    }

    const result: Record<string, string> = {}
    Object.entries(headers).forEach(([key, value]) => {
      result[key] = SecretResolver.replaceRefs(value, secrets)
    })
    return result
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
      encryptedValue: string
      orgId?: string
      projectId?: string
      providerId?: string
      agentId?: string
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
        // Decryption failed with scope owner — may be encrypted with a different key
      }
    }

    // Fallback: try orgId (handles quickstart encryption mismatch)
    if (orgId && orgId !== refId) {
      try {
        const key = await deriveKey(orgId)
        return await decryptValue(key, ciphertext, iv, authTag)
      } catch {
        // Both attempts failed
      }
    }

    return null
  }

  /**
   * Resolve an API key from secrets using a 3-tier fallback:
   * 1. Agent-scoped secrets (from agent relation)
   * 2. Provider-scoped secrets (query by providerId)
   * 3. Org-scoped secrets (query by orgId)
   */
  resolveApiKey = async (agent: {
    secrets?: Array<{
      encryptedValue: string
      orgId?: string
      projectId?: string
      providerId?: string
      agentId?: string
    }>
    providerId: string
    orgId: string
  }): Promise<string> => {
    let apiKey = ``

    // 1. Try agent-scoped secrets
    if (agent.secrets?.length) {
      for (const secret of agent.secrets) {
        const value = await this.decrypt(secret, agent.orgId)
        if (value) {
          apiKey = value
          break
        }
      }
    }

    // 2. Try provider-scoped secrets
    if (!apiKey) {
      const { data: providerSecrets } = await this.db.services.secret.list({
        where: { providerId: agent.providerId },
      })
      if (providerSecrets?.length) {
        for (const secret of providerSecrets) {
          const value = await this.decrypt(secret, agent.orgId)
          if (value) {
            apiKey = value
            break
          }
        }
      }
    }

    // 3. Try org-scoped secrets
    if (!apiKey) {
      const { data: orgSecrets } = await this.db.services.secret.list({
        where: { orgId: agent.orgId },
      })
      if (orgSecrets?.length) {
        for (const secret of orgSecrets) {
          const value = await this.decrypt(secret, agent.orgId)
          if (value) {
            apiKey = value
            break
          }
        }
      }
    }

    return apiKey
  }

  /**
   * Loads provider-scoped + org-scoped secrets, deduplicates, and decrypts them.
   * Provider-scoped secrets take precedence over org-scoped when names collide.
   */
  loadAndDecrypt = async (scope: {
    providerId: string
    orgId: string
  }): Promise<Secret[]> => {
    const { data: providerSecrets } = await this.db.services.secret.list({
      where: { providerId: scope.providerId },
    })
    const { data: orgSecrets } = await this.db.services.secret.list({
      where: { orgId: scope.orgId },
    })

    const decrypted: Secret[] = []
    const allSecrets = [...(providerSecrets || []), ...(orgSecrets || [])]
    const seen = new Set<string>()

    for (const secret of allSecrets) {
      const name = secret.name || secret.hashKey
      if (seen.has(name)) continue
      seen.add(name)

      const value = await this.decrypt(secret, scope.orgId)
      if (value) {
        decrypted.push({ ...secret, value } as Secret)
      }
    }

    return decrypted
  }

  /**
   * Resolves {{SECRET_NAME}} templates in provider.headers using decrypted secrets.
   *
   * 1. If headers is empty/undefined → returns undefined
   * 2. If no {{...}} patterns found → returns headers as-is (no DB queries)
   * 3. Otherwise → loads provider-scoped secrets (falls back to org-scoped),
   *    decrypts each, and replaces template references
   */
  resolveHeaders = async (provider: {
    id: string
    orgId: string
    headers?: Record<string, string>
  }): Promise<Record<string, string> | undefined> => {
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

import { deriveKey, decryptValue } from '@tdsk/domain'

/**
 * Decrypt a secret's encryptedValue using the appropriate scope owner ID.
 * Falls back to orgId if decryption with the owner ID fails (handles
 * quickstart secrets that were encrypted with orgId but stored as provider-scoped).
 */
export const decryptSecret = async (
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
export const resolveApiKey = async (
  agent: { secrets?: Array<Record<string, any>>; providerId: string; orgId: string },
  db: { services: { secret: { list: (opts: any) => Promise<{ data?: any[] }> } } }
): Promise<string> => {
  let apiKey = ``

  // 1. Try agent-scoped secrets
  if (agent.secrets?.length) {
    for (const secret of agent.secrets) {
      const value = await decryptSecret(secret, agent.orgId)
      if (value) {
        apiKey = value
        break
      }
    }
  }

  // 2. Try provider-scoped secrets
  if (!apiKey) {
    const { data: providerSecrets } = await db.services.secret.list({
      where: { providerId: agent.providerId },
    })
    if (providerSecrets?.length) {
      for (const secret of providerSecrets) {
        const value = await decryptSecret(secret, agent.orgId)
        if (value) {
          apiKey = value
          break
        }
      }
    }
  }

  // 3. Try org-scoped secrets
  if (!apiKey) {
    const { data: orgSecrets } = await db.services.secret.list({
      where: { orgId: agent.orgId },
    })
    if (orgSecrets?.length) {
      for (const secret of orgSecrets) {
        const value = await decryptSecret(secret, agent.orgId)
        if (value) {
          apiKey = value
          break
        }
      }
    }
  }

  return apiKey
}

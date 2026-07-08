import type { TDatabase } from '@tdsk/database'

import { logger } from '@TBE/utils/logger'
import { ApiKey, Exception, generateApiKey } from '@tdsk/domain'

/**
 * Mint (or rotate) the resident-bound api key for an agent. Any previously
 * ACTIVE resident keys for the agent are revoked first, then a fresh
 * org-scoped key is created with `residentAgentId` binding it to exactly one
 * agent. The bearer secret is returned ONCE — only its hash is stored
 * (mirrors createApiKey). The key carries NO permissions: it authorizes only
 * the resident dispatch surface, which checks the residentAgentId binding
 * itself.
 *
 * Called by the platform at resident pod start (injected as
 * TDSK_RESIDENT_TOKEN in R3/R4) — deliberately NOT exposed as an endpoint.
 */
export const mintResidentToken = async (
  db: TDatabase,
  orgId: string,
  agentId: string
): Promise<{ key: string; apiKey: ApiKey }> => {
  const { data: existing, error: listErr } =
    await db.services.apiKey.getByResidentAgent(agentId)
  if (listErr)
    throw new Exception(500, `Failed to list resident keys: ${listErr.message}`)

  for (const old of existing ?? []) {
    const { error: revokeErr } = await db.services.apiKey.revoke(old.id)
    if (revokeErr)
      throw new Exception(500, `Failed to rotate resident key: ${revokeErr.message}`)
  }

  const { key, hash, prefix } = generateApiKey()
  const { data, error } = await db.services.apiKey.create(
    new ApiKey({
      orgId,
      active: true,
      keyHash: hash,
      permissions: [],
      keyPrefix: prefix,
      residentAgentId: agentId,
      name: `resident:${agentId}`,
    })
  )
  if (error || !data)
    throw new Exception(
      500,
      `Failed to mint resident token: ${error?.message ?? `unknown`}`
    )

  logger.info(`[resident] Minted resident token for agent ${agentId} (key ${data.id})`)

  return { key, apiKey: data }
}

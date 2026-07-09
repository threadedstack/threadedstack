import type { TDatabase } from '@tdsk/database'

import { logger } from '@TBE/utils/logger'
import { ApiKey, Exception, generateApiKey } from '@tdsk/domain'

/**
 * CREATE a fresh resident-bound api key for an agent WITHOUT revoking any
 * existing keys. A new org-scoped key is created with `residentAgentId` binding
 * it to exactly one agent. The bearer secret is returned ONCE — only its hash is
 * stored (mirrors createApiKey). The key carries NO permissions: it authorizes
 * only the resident dispatch surface, which checks the residentAgentId binding
 * itself.
 *
 * Separating create from revoke lets the watchdog mint the new pod's token
 * BEFORE tearing down the old pod, so the old pod keeps a VALID token through
 * its graceful-shutdown checkpoint; prior keys are revoked afterwards via
 * `revokeResidentKeysExcept`.
 */
export const createResidentToken = async (
  db: TDatabase,
  orgId: string,
  agentId: string
): Promise<{ key: string; apiKey: ApiKey }> => {
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

/**
 * Revoke every ACTIVE resident key for an agent except `keepKeyId` (the freshly
 * minted one). Called after the new pod has started + the old pod has been
 * torn down, so the previous pod's token stayed valid for its shutdown window.
 */
export const revokeResidentKeysExcept = async (
  db: TDatabase,
  agentId: string,
  keepKeyId: string
): Promise<void> => {
  const { data: existing, error: listErr } =
    await db.services.apiKey.getByResidentAgent(agentId)
  if (listErr)
    throw new Exception(500, `Failed to list resident keys: ${listErr.message}`)

  for (const old of existing ?? []) {
    if (old.id === keepKeyId) continue
    const { error: revokeErr } = await db.services.apiKey.revoke(old.id)
    if (revokeErr)
      throw new Exception(500, `Failed to revoke stale resident key: ${revokeErr.message}`)
  }
}

/**
 * Mint (rotate) the resident-bound api key for an agent: create the fresh key
 * first, then revoke all prior keys — no window with zero active keys. The
 * public rotate entrypoint; the watchdog uses the granular create/revoke pair
 * so the old pod keeps a valid token through its shutdown.
 *
 * Called by the platform at resident pod start (injected as
 * TDSK_RESIDENT_TOKEN) — deliberately NOT exposed as an endpoint.
 */
export const mintResidentToken = async (
  db: TDatabase,
  orgId: string,
  agentId: string
): Promise<{ key: string; apiKey: ApiKey }> => {
  const created = await createResidentToken(db, orgId, agentId)
  await revokeResidentKeysExcept(db, agentId, created.apiKey.id)
  return created
}

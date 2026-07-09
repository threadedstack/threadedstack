import type { NextFunction } from 'express'
import type { TRequest, TResponse } from '@TBE/types'

import { logger } from '@TBE/utils/logger'
import { hashKey, Exception, ApiKeyPrefix } from '@tdsk/domain'

/**
 * Auth middleware for the resident dispatch surface. The ONLY accepted
 * principal is a Bearer `tdsk_*` api key that (a) verifies normally (hash
 * lookup, active, not expired) AND (b) is resident-bound to exactly the
 * `:agentId` in the URL (`residentAgentId` on the key row, minted by the
 * resident watchdog via createResidentToken). Every other principal — no key, a user JWT, a normal
 * org/project api key, a resident key for another agent — is rejected;
 * admins use the normal authenticated surfaces instead.
 *
 * Verifies the RAW Authorization header itself (rather than proxy-forwarded
 * user headers): residents call the backend through the public proxy, which
 * passes resident-bound keys through WITHOUT attaching a user principal — the
 * bearer is the sole credential and this middleware is the authority.
 */
export const residentAuth = async (
  req: TRequest,
  _res: TResponse,
  next: NextFunction
) => {
  try {
    const header = req.headers?.authorization
    const token =
      typeof header === `string` && header.startsWith(`Bearer `)
        ? header.slice(7).trim()
        : undefined

    if (!token || !token.startsWith(ApiKeyPrefix))
      throw new Exception(401, `A resident API key is required`)

    const { db } = req.app.locals
    const { data: apiKey, error } = await db.services.apiKey.getByHash(hashKey(token))
    if (error || !apiKey) throw new Exception(401, `Invalid API key`)

    if (!apiKey.isValid())
      throw new Exception(401, apiKey.isExpired() ? `API key expired` : `API key revoked`)

    if (!apiKey.residentAgentId) throw new Exception(403, `Not a resident API key`)

    if (apiKey.residentAgentId !== req.params.agentId)
      throw new Exception(403, `Resident key is not bound to this agent`)

    db.services.apiKey
      .touchLastUsed(apiKey.id)
      .catch((err: Error) =>
        logger.error(`Failed to update resident key lastUsedAt: ${err.message}`)
      )

    next()
  } catch (err) {
    next(err)
  }
}

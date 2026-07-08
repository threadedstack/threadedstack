import type { TProxyApp } from '@TPX/types'
import type { Request, Response, NextFunction } from 'express'

import { logger } from '@TPX/utils/logger'
import { hashKey, ApiKeyPrefix } from '@tdsk/domain'

/**
 * API Key Authentication middleware
 * Validates API keys as a fallback when JWT auth doesn't set req.user
 *
 * Flow:
 * 1. If req.user already set (JWT succeeded) → skip
 * 2. If route is public → skip
 * 3. Extract token from Authorization header
 * 4. If no token or non-API-key token:
 *    - Session routes and deferred-auth routes (/proxy/*) pass through
 *      (backend handles auth after endpoint lookup)
 *    - All other routes get 401
 * 5. Hash API key and look up in database
 * 6. Validate (active, not expired)
 * 7. Resident-bound keys (residentAgentId set) pass through WITHOUT a user
 *    principal — the backend's residentAuth verifies the raw bearer itself
 * 8. Set req.user with key's userId, orgId, projectId, and apiKeyId
 */
export const validateApiKeyAuth = (app: TProxyApp) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.user) return next()
    if (app.locals.auth.isPublic(req.path)) return next()

    const token = app.locals.auth.extract(req)

    // No token at all — session and deferred-auth routes pass through
    if (!token) {
      if (app.locals.auth.isSession(req.path)) return next()
      if (app.locals.auth.isDeferredAuth(req.path)) return next()
      res.status(401).json({ error: `No authentication token provided` })
      return
    }

    // Not an API key — session and deferred-auth routes pass through
    if (!token.startsWith(ApiKeyPrefix)) {
      if (app.locals.auth.isSession(req.path)) return next()
      if (app.locals.auth.isDeferredAuth(req.path)) return next()
      res.status(401).json({ error: `Invalid authentication token` })
      return
    }

    try {
      const keyHash = hashKey(token)
      const { data: apiKey, error } =
        await app.locals.db.services.apiKey.getByHash(keyHash)

      if (error || !apiKey) {
        res.status(401).json({ error: `Invalid API key` })
        return
      }

      if (!apiKey.isValid()) {
        res.status(401).json({
          error: apiKey.isExpired() ? `API key expired` : `API key revoked`,
        })
        return
      }

      // Resident carve-out: a resident-bound key (minted by the backend's
      // mintResidentToken) has NO userId and NEVER attaches a user principal.
      // The request passes through with its Authorization header intact and
      // the backend's residentAuth middleware is the authority — it verifies
      // the raw bearer + the residentAgentId binding itself. The proxy still
      // strips/rewrites X-User-* headers on forward, so no principal rides in.
      if (apiKey.residentAgentId) {
        logger.debug(`Resident API key validated for agent: ${apiKey.residentAgentId}`)

        app.locals.db.services.apiKey.touchLastUsed(apiKey.id).catch((err: Error) =>
          logger.error({
            message: `Failed to update API key lastUsedAt`,
            apiKeyId: apiKey.id,
            residentAgentId: apiKey.residentAgentId,
            error: err.message,
          })
        )

        return next()
      }

      if (!apiKey.userId) {
        logger.error(`API key ${apiKey.id} has no associated userId`)
        res.status(401).json({ error: `Invalid API key configuration` })
        return
      }

      req.user = {
        email: ``,
        userId: apiKey.userId,
        ...(apiKey.orgId && { orgId: apiKey.orgId }),
        ...(apiKey.projectId && { projectId: apiKey.projectId }),
        apiKeyId: apiKey.id,
      }

      logger.debug(`API key validated for user: ${req.user.userId}`)

      app.locals.db.services.apiKey.touchLastUsed(apiKey.id).catch((err: Error) =>
        logger.error({
          message: `Failed to update API key lastUsedAt`,
          apiKeyId: apiKey.id,
          userId: apiKey.userId,
          error: err.message,
        })
      )

      next()
    } catch (err) {
      logger.error({
        message: `API key verification error`,
        error: err instanceof Error ? err.message : String(err),
      })
      res.status(500).json({ error: `Authentication error` })
    }
  }
}

export const setupApiKeyAuth = (app: TProxyApp) => {
  app.use(validateApiKeyAuth(app))
}

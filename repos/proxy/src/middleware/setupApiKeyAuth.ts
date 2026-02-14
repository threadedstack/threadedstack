import type { TProxyApp } from '@TPX/types'
import type { Request, Response, NextFunction } from 'express'

import { logger } from '@TPX/utils/logger'
import { hashKey, ApiKeyPrefix } from '@tdsk/domain'

/**
 * TODO: Use enum for scopes, no hard coded strings
 * Map API key scopes to backend-compatible roles
 */
const scopeToRole = (scopes?: string): string => {
  if (!scopes) return `viewer`
  const scopeList = scopes.split(`,`).map((s) => s.trim())
  if (scopeList.includes(`admin`)) return `admin`
  if (scopeList.includes(`write`)) return `member`
  return `viewer`
}

/**
 * API Key Authentication middleware
 * Validates API keys as a fallback when JWT auth doesn't set req.user
 *
 * Flow:
 * 1. If req.user already set (JWT succeeded) → skip
 * 2. If route is public → skip
 * 3. Extract API key from Authorization: Bearer tdsk_...
 * 4. Hash and look up in database
 * 5. Validate (active, not expired)
 * 6. Set req.user with key's userId and scope-derived role
 */
export const validateApiKeyAuth = (app: TProxyApp) => {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    if (req.user) return next()
    if (app.locals.auth.isPublic(req.path)) return next()

    // /ai/chat uses session-token auth, skip API key
    if (req.path.startsWith(`/ai/chat`)) return next()

    const token = app.locals.auth.extract(req)

    // No token at all — no auth provided
    if (!token) {
      res.status(401).json({ error: `No authentication token provided` })
      return
    }

    // Not an API key — token was present but not handled by JWT middleware either
    if (!token.startsWith(ApiKeyPrefix)) {
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

      if (!apiKey.userId) {
        logger.error(`API key ${apiKey.id} has no associated userId`)
        res.status(401).json({ error: `Invalid API key configuration` })
        return
      }

      req.user = {
        email: ``,
        userId: apiKey.userId,
        role: scopeToRole(apiKey.scopes),
      }

      logger.debug(`API key validated for user: ${req.user.userId}`)

      app.locals.db.services.apiKey
        .touchLastUsed(apiKey.id)
        .catch((err: Error) => logger.error(`Failed to update API key lastUsedAt:`, err))

      next()
    } catch (err) {
      logger.error(`API key verification error:`, err)
      res.status(500).json({ error: `Authentication error` })
    }
  }
}

export const setupApiKeyAuth = (app: TProxyApp) => {
  app.use(validateApiKeyAuth(app))
}

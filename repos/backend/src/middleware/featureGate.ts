import type { TFeatureFlagName } from '@tdsk/domain'
import { isFeatureEnabled } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import type { RequestHandler } from 'express'

export function featureGate(flag: TFeatureFlagName): RequestHandler {
  return (req, res, next) => {
    if (isFeatureEnabled(flag)) return next()
    logger.debug(
      `[featureGate] Blocked ${req.method} ${req.path} — flag '${flag}' is disabled`
    )
    // 404 (not 403) is intentional: the route is invisible while the flag is off
    // so we don't leak feature existence. Do not "fix" this back to 403.
    res.status(404).json({ error: `Not found` })
  }
}

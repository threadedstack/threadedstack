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
    res.status(404).json({ error: `Not found` })
  }
}

import type { TFeatureFlagName } from '@tdsk/domain'
import { isFeatureEnabled } from '@tdsk/domain'
import type { RequestHandler } from 'express'

export function featureGate(flag: TFeatureFlagName): RequestHandler {
  return (req, res, next) => {
    if (isFeatureEnabled(flag)) return next()
    res.status(404).json({ error: `Not found` })
  }
}

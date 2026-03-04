import type { TRequest, TResponse, TApp } from '@TBE/types'
import type { NextFunction, Router, RequestHandler } from 'express'

import { logger } from '@TBE/utils/logger'
import { shouldIgnore } from '@TBE/utils/auth/shouldIgnore'
import { authenticateRequest } from '@TBE/utils/auth/authenticateRequest'

export const authenticate = async (req: TRequest, res: TResponse, next: NextFunction) => {
  try {
    if (shouldIgnore(req)) {
      next()
      return
    }

    await authenticateRequest(req, res)
    next()
  } catch (err: any) {
    const status = err?.status || 401
    const message = err instanceof Error ? err.message : `Authentication failed`
    logger.error(`Auth middleware error:`, { error: err })
    res.status(status).json({ error: message })
  }
}

export const setupAuth = async (app: TApp, router: Router) => {
  router.use(authenticate as RequestHandler)
}

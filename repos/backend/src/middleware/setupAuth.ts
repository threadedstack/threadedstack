import type { NextFunction, Router } from 'express'
import type { TRequest, TResponse, TApp } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { shouldIgnore } from '@TBE/utils/auth/shouldIgnore'

export const authenticate = async (req: TRequest, res: TResponse, next: NextFunction) => {
  try {
    //if(!config.server.jwt?.active) return next()

    if (shouldIgnore(req)) {
      next()
      return
    }

    const token = req.header(`Authorization`)?.split(' ')[1]
    if (!token) throw Error(`Authorization is required`)

    const { db } = req.app?.locals
    const { user, error } = await db.validate({ access_token: token })

    if (error) {
      logger.error(error)
      res.status(401).json({ error: error.message })
      return
    }

    res.locals.user = user
    next()
  } catch (err) {
    res.status(401).json({ error: `Invalid token, auth denied!` })
  }
}

export const setupAuth = async (app: TApp, router: Router) => {
  router.use(authenticate)
}

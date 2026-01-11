import type { NextFunction, Router } from 'express'
import type { TRequest, TResponse, TApp } from '@TBE/types'

import { User } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { fromAuthHeaders } from '@tdsk/domain'
import { shouldIgnore } from '@TBE/utils/auth/shouldIgnore'
import { pxToBeHeader } from '@TBE/utils/auth/pxToBeHeader'

export const authenticate = async (req: TRequest, res: TResponse, next: NextFunction) => {
  try {
    if (shouldIgnore(req)) {
      next()
      return
    }

    pxToBeHeader(req)

    const { db } = req.app?.locals

    const auth = fromAuthHeaders(req)
    if (!auth.userId) throw Error(`A valid and authorized user is required.`)

    const { data: user, error } = await db.services.user.get(auth.userId)

    if (error) throw error
    if (!user) throw Error(`A valid and authorized user could not be found.`)

    req.user = user
    next()
  } catch (err) {
    logger.error(err)
    res.status(401).json({ error: err.message })
  }
}

export const setupAuth = async (app: TApp, router: Router) => {
  router.use(authenticate)
}

import type { TRequest, TResponse, TApp } from '@TBE/types'
import type { NextFunction, Router, RequestHandler } from 'express'

import type { TAuthHeaderObj } from '@tdsk/domain'

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

    // Safe cast: userId is validated above; email is assumed present from proxy headers; orgId/projectId/role/apiKeyId are optional
    req.app.locals.auth = auth as TAuthHeaderObj
    const { data: user, error } = await db.services.user.get(auth.userId)

    if (error) throw error
    if (!user) throw Error(`A valid and authorized user could not be found.`)

    req.user = user
    next()
  } catch (err: any) {
    logger.error(err)
    res.status(401).json({ error: err.message })
  }
}

export const setupAuth = async (app: TApp, router: Router) => {
  router.use(authenticate as RequestHandler)
}

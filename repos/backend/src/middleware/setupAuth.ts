import type { NextFunction, Router } from 'express'
import type { TRequest, TResponse, TApp } from '@tdsk/domain'

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
    console.log(`------- auth -------`)
    console.log(auth)

    const token = req.header(`Authorization`)?.split(' ')[1]

    if (!token) throw Error(`Authorization is required`)

    res.status(200).json({ data: [] })

    next()
  } catch (err) {
    logger.error(err)
    res.status(401).json({ error: `Invalid token, auth denied!` })
  }
}

export const setupAuth = async (app: TApp, router: Router) => {
  router.use(authenticate)
}

import type { Response } from 'express'
import type { TRequest } from '@TBE/types'
import type { TAuthHeaderObj } from '@tdsk/domain'

import { logger } from '@TBE/utils/logger'
import { Exception, fromAuthHeaders } from '@tdsk/domain'
import { pxToBeHeader } from '@TBE/utils/auth/pxToBeHeader'

/**
 * Authenticate a request by extracting auth from proxy-forwarded headers
 * and loading the user from the database.
 *
 * Unlike the `authenticate` middleware, this is a callable function
 * that can be used inline after conditional checks (e.g., non-public endpoints).
 *
 * Sets `req.user` and `res.locals.auth` on success.
 * Throws Exception(401) on failure.
 */
export const authenticateRequest = async (
  req: TRequest,
  res: Response
): Promise<void> => {
  pxToBeHeader(req)

  const db = req.app?.locals?.db
  if (!db) throw new Exception(500, `Database service not available`)

  const auth = fromAuthHeaders(req)
  if (!auth.userId) throw new Exception(401, `A valid and authorized user is required`)

  res.locals.auth = auth as TAuthHeaderObj
  const { data: user, error } = await db.services.user.get(auth.userId)

  if (error) {
    logger.error(`Auth user lookup failed:`, error)
    throw new Exception(401, `Authentication failed`)
  }
  if (!user) throw new Exception(401, `A valid and authorized user could not be found`)

  req.user = user
}

import type { NextFunction } from 'express'
import type { TAHandler } from '@tdsk/domain'
import type { TRequest, TResponse } from '@TBE/types'

import { Exception } from '@tdsk/domain'
import { logger } from '@TBE/utils/logger'
import { requireProjectAccess } from '@TBE/utils/auth/requireProjectAccess'

/**
 * Middleware that enforces project membership for JWT-authenticated users.
 * Complements projectAccessGuard (which handles API key scoping) by also
 * verifying that JWT/org-scoped-key users are members of the target project.
 * Org admins+ bypass this check.
 */
export const projectMemberGuard = () => {
  const callback = async (req: TRequest, res: TResponse, next: NextFunction) => {
    const orgId = req.params.orgId
    const projectId = req.params.projectId

    if (!projectId || !orgId) {
      logger.error({
        path: req.path,
        method: req.method,
        orgId: orgId || `(missing)`,
        projectId: projectId || `(missing)`,
        message: `projectMemberGuard requires :orgId and :projectId in URL`,
      })
      res
        .status(400)
        .json({ error: `projectMemberGuard requires :orgId and :projectId in URL` })
      return
    }

    try {
      await requireProjectAccess(req, projectId, orgId)
      next()
    } catch (error: any) {
      const isExpected = error instanceof Exception
      const status = error?.statusCode || error?.status || (isExpected ? 403 : 500)
      const message = error?.message || `Access denied`

      logger.error({
        message: `projectMemberGuard ${isExpected ? `denied` : `error`}`,
        path: req.path,
        method: req.method,
        error: message,
        status,
      })

      res.status(status).json({ error: message })
    }
  }

  return callback as TAHandler
}
